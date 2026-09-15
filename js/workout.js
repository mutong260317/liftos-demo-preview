/* WorkoutSession lifecycle: create, mutate, persist, undo, replace, finish. */

window.LiftOS = window.LiftOS || {};

LiftOS.Workout = (() => {
  const S = () => LiftOS.Stats;
  const St = () => LiftOS.Storage;

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function defaultIncrement(exerciseId) {
    return LiftOS.getExercise(exerciseId)?.defaultIncrement ?? 2.5;
  }

  function suggestedWeightFor(exerciseId, planEx) {
    const bw = LiftOS.isBodyweight(exerciseId);
    const rows = S().exerciseHistory(exerciseId);
    const sug = LiftOS.Progression.getProgressionSuggestion({
      exerciseId,
      repMin: planEx.repMin,
      repMax: planEx.repMax,
      historyRows: rows,
    });
    const weight = bw ? Number(sug.suggestedWeight) || 0 : sug.suggestedWeight;
    return { weight, advice: sug };
  }

  function makeSet(type, num, weight) {
    return {
      id: uid("set"),
      type, // warmup | work | drop | failure
      num,
      weight: weight ?? null,
      reps: null,
      rir: null,
      completed: false,
      completedAt: null,
    };
  }

  /** Build a fresh session from a real plan. */
  function createFromPlan(plan) {
    if (!plan || !plan.exercises?.length) throw new Error("empty plan");

    const exercises = plan.exercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((pe) => {
        const master = LiftOS.getExercise(pe.exerciseId);
        const { weight, advice } = suggestedWeightFor(pe.exerciseId, pe);
        const bw = LiftOS.isBodyweight(pe.exerciseId);
        const sets = [];
        // warm-up only for loaded compounds
        if (master && !bw && master.category === "compound" && pe.workSets >= 3 && weight > 0) {
          const warm = Math.max(0, Math.round((weight * 0.5) / 2.5) * 2.5);
          sets.push(makeSet("warmup", 0, warm));
        }
        for (let i = 0; i < pe.workSets; i++) {
          sets.push(makeSet("work", i + 1, bw ? 0 : weight));
        }
        return {
          id: uid("ex"),
          exerciseId: pe.exerciseId,
          name: master?.name || pe.exerciseId,
          muscle: master?.muscleLabel || "",
          planExercise: {
            workSets: pe.workSets,
            repMin: pe.repMin,
            repMax: pe.repMax,
            targetRirMin: pe.targetRirMin,
            targetRirMax: pe.targetRirMax,
            restSeconds: pe.restSeconds,
          },
          sets,
          skipped: false,
          advice,
          notes: St().getNote(pe.exerciseId),
        };
      });

    return {
      id: uid("ws"),
      planId: plan.id,
      planName: plan.name,
      startTime: Date.now(),
      endTime: null,
      exIndex: 0,
      exercises,
      prs: [],
      rest: null, // { endsAt, duration, startedAt }
      feeling: null,
      note: "",
      version: 2,
    };
  }

  function save(session) {
    St().saveSession(session);
  }

  function currentEx(session) {
    return session?.exercises?.[session.exIndex] || null;
  }

  function activeSetIndex(session) {
    const ex = currentEx(session);
    if (!ex) return -1;
    return ex.sets.findIndex((s) => !s.completed);
  }

  function workSetsOf(ex) {
    return (ex?.sets || []).filter((s) => S().isWork(s));
  }

  function allWorkDone(ex) {
    const w = workSetsOf(ex);
    return w.length > 0 && w.every((s) => s.completed);
  }

  function canComplete(set) {
    if (!set) return false;
    if (S().isWarmup(set)) return set.weight != null && set.reps != null && set.reps > 0;
    return set.weight != null && set.reps != null && set.reps > 0;
  }

  /** Core: mark set complete. Must have real reps. RIR optional. */
  function completeSet(session, setIdx, payload) {
    const ex = currentEx(session);
    if (!ex) return { ok: false, error: "no exercise" };
    const set = ex.sets[setIdx];
    if (!set) return { ok: false, error: "no set" };

    if (payload?.weight != null) set.weight = payload.weight;
    if (payload?.reps != null) set.reps = payload.reps;
    if (payload?.rir !== undefined) set.rir = payload.rir; // null allowed = 未记录

    const bw = LiftOS.isBodyweight(ex.exerciseId);
    if (set.reps == null || set.reps <= 0) {
      return { ok: false, error: "需要填写真实次数" };
    }
    if (set.weight == null || set.weight < 0) {
      return { ok: false, error: bw ? "自重 weight 应为 0 或附加负重" : "需要填写重量" };
    }
    if (!bw && set.weight === 0 && !LiftOS.isBodyweight(ex.exerciseId)) {
      // loaded exercise with 0kg is unusual but allowed only if bodyweight
    }

    set.completed = true;
    set.completedAt = Date.now();

    const newPrs = [];
    if (S().isWork(set)) {
      // Baseline = stored history + this session's earlier completed work sets for same exercise
      const liveRows = S().sessionBaseline(session, ex.exerciseId, set.id);
      const prior = S().detectSetPRs(ex.exerciseId, set, liveRows);
      prior.forEach((p) => {
        newPrs.push({
          ...p,
          exerciseId: ex.exerciseId,
          exerciseName: ex.name,
          setId: set.id,
          weight: set.weight,
          reps: set.reps,
        });
      });
      session.prs = session.prs || [];
      newPrs.forEach((p) => session.prs.push(p));
    }

    // rest auto-start
    const restSec = ex.planExercise?.restSeconds || St().getPrefs().restDefault || 90;
    session.rest = {
      duration: restSec,
      endsAt: Date.now() + restSec * 1000,
      startedAt: Date.now(),
    };

    save(session);
    return { ok: true, prs: newPrs, restSeconds: restSec, set };
  }

  function undoSet(session, setIdx) {
    const ex = currentEx(session);
    if (!ex || !ex.sets[setIdx]) return { ok: false, error: "no set" };
    const set = ex.sets[setIdx];
    if (!set.completed) return { ok: false, error: "not completed" };

    set.completed = false;
    set.completedAt = null;
    // keep user-entered weight/reps/rir for re-edit — do not wipe

    // remove PRs tied to this set
    session.prs = (session.prs || []).filter((p) => p.setId !== set.id);

    save(session);
    return { ok: true, set };
  }

  function updateSetField(session, setIdx, field, value) {
    const ex = currentEx(session);
    if (!ex || !ex.sets[setIdx]) return;
    ex.sets[setIdx][field] = value;
    save(session);
  }

  function setNotes(session, text) {
    const ex = currentEx(session);
    if (!ex) return;
    ex.notes = text;
    St().setNote(ex.exerciseId, text);
    save(session);
  }

  function addExerciseToSession(session, exerciseId, params = {}) {
    const master = LiftOS.getExercise(exerciseId);
    if (!master) return false;
    const pe = {
      ...(master.defaultParams || {}),
      workSets: params.workSets ?? master.defaultParams?.workSets ?? 3,
      repMin: params.repMin ?? master.defaultParams?.repMin ?? 8,
      repMax: params.repMax ?? master.defaultParams?.repMax ?? 12,
      targetRirMin: params.targetRirMin ?? master.defaultParams?.targetRirMin ?? 1,
      targetRirMax: params.targetRirMax ?? master.defaultParams?.targetRirMax ?? 2,
      restSeconds: params.restSeconds ?? master.defaultParams?.restSeconds ?? 90,
    };
    const { weight, advice } = suggestedWeightFor(exerciseId, pe);
    const bw = LiftOS.isBodyweight(exerciseId);
    const sets = [];
    for (let i = 0; i < pe.workSets; i++) {
      sets.push(makeSet("work", i + 1, bw ? 0 : weight));
    }
    session.exercises.push({
      id: uid("ex"),
      exerciseId,
      name: master.name,
      muscle: master.muscleLabel,
      planExercise: pe,
      sets,
      skipped: false,
      advice,
      notes: St().getNote(exerciseId),
    });
    save(session);
    return true;
  }

  /**
   * Replace current exercise.
   * mode: 'default' | 'reuse' — use master.defaultParams or keep old plan params.
   * Notes are NEVER copied across different exercise ids.
   */
  function replaceExercise(session, newExerciseId, mode = "default") {
    const ex = currentEx(session);
    if (!ex) return false;
    if (newExerciseId === ex.exerciseId) return false;

    const master = LiftOS.getExercise(newExerciseId);
    if (!master) return false;

    const oldParams = ex.planExercise;
    const pe =
      mode === "reuse"
        ? { ...oldParams }
        : { ...(master.defaultParams || { workSets: 3, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 90 }) };

    const { weight, advice } = suggestedWeightFor(newExerciseId, pe);
    const bw = LiftOS.isBodyweight(newExerciseId);
    const sets = [];
    for (let i = 0; i < pe.workSets; i++) {
      sets.push(makeSet("work", i + 1, bw ? 0 : weight));
    }

    const idx = session.exIndex;
    session.exercises[idx] = {
      id: uid("ex"),
      exerciseId: newExerciseId,
      name: master.name,
      muscle: master.muscleLabel,
      planExercise: pe,
      sets,
      skipped: false,
      advice,
      notes: St().getNote(newExerciseId), // independent notes
      replacedFrom: { id: ex.exerciseId, name: ex.name },
    };
    save(session);
    return true;
  }

  function skipExercise(session) {
    const ex = currentEx(session);
    if (!ex) return false;
    ex.skipped = true;
    save(session);
    return nextExercise(session);
  }

  function nextExercise(session) {
    if (session.exIndex >= session.exercises.length - 1) return false;
    session.exIndex += 1;
    session.rest = null;
    save(session);
    return true;
  }

  function startRest(session, seconds) {
    session.rest = {
      duration: seconds,
      endsAt: Date.now() + seconds * 1000,
      startedAt: Date.now(),
    };
    save(session);
  }

  function adjustRest(session, delta) {
    if (!session.rest) return;
    session.rest.endsAt = Math.max(Date.now(), session.rest.endsAt + delta * 1000);
    session.rest.duration = Math.max(0, Math.round((session.rest.endsAt - session.rest.startedAt) / 1000));
    save(session);
  }

  function clearRest(session) {
    session.rest = null;
    save(session);
  }

  function restRemaining(session) {
    if (!session?.rest?.endsAt) return 0;
    return Math.max(0, Math.ceil((session.rest.endsAt - Date.now()) / 1000));
  }

  /** Finish: archive to history, clear active session. */
  function finish(session, extras = {}) {
    const volume = S().sessionVolume(session);
    const workSets = S().workSetCount(session);
    const elapsedMs = (session.endTime || Date.now()) - session.startTime;

    const entry = {
      id: session.id,
      date: LiftOS.localDateKey(new Date(session.startTime)),
      planId: session.planId,
      planName: session.planName,
      startTime: session.startTime,
      endTime: Date.now(),
      durationMinutes: Math.max(1, Math.round(elapsedMs / 60000)),
      volume,
      workSets,
      prs: (session.prs || []).length,
      feeling: extras.feeling ?? session.feeling,
      note: extras.note ?? session.note,
      exercises: session.exercises
        .filter((ex) => !ex.skipped)
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          sets: ex.sets
            .filter((s) => s.completed && S().isWork(s))
            .map((s) => ({
              type: s.type,
              weight: s.weight,
              reps: s.reps,
              rir: s.rir,
              completedAt: s.completedAt,
            })),
        }))
        .filter((ex) => ex.sets.length),
    };

    St().appendHistory(entry);
    St().clearSession();
    return entry;
  }

  function abandon() {
    St().clearSession();
  }

  function summaryModel(session) {
    return {
      durationMs: (session.endTime || Date.now()) - session.startTime,
      exercises: S().completedExerciseCount(session),
      workSets: S().workSetCount(session),
      volume: S().sessionVolume(session),
      prs: session.prs || [],
      avgRir: S().avgRir(session),
      muscles: S().muscleWorkSets(session),
    };
  }

  return {
    createFromPlan,
    save,
    currentEx,
    activeSetIndex,
    workSetsOf,
    allWorkDone,
    canComplete,
    completeSet,
    undoSet,
    updateSetField,
    setNotes,
    addExerciseToSession,
    replaceExercise,
    skipExercise,
    nextExercise,
    startRest,
    adjustRest,
    clearRest,
    restRemaining,
    finish,
    abandon,
    summaryModel,
    suggestedWeightFor,
    makeSet,
    uid,
  };
})();
