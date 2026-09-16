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
      type, // warmup | work | drop | failure | amrap
      num,
      weight: weight ?? null,
      reps: null,
      rir: null,
      durationSec: null,
      loadMode: "external",
      assistanceKg: null,
      addedWeightKg: null,
      completed: false,
      completedAt: null,
    };
  }

  function isLastWorkSetOfExercise(ex, setIdx) {
    const workIdxs = ex.sets.map((s, i) => ({ s, i })).filter(({ s }) => S().isWork(s));
    if (!workIdxs.length) return true;
    return workIdxs[workIdxs.length - 1].i === setIdx;
  }

  function isSupersetWithNext(session) {
    const ex = currentEx(session);
    if (!ex?.supersetGroup) return false;
    const next = session.exercises[session.exIndex + 1];
    return !!(next && next.supersetGroup === ex.supersetGroup && !next.skipped);
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
          const s = makeSet("work", i + 1, bw ? 0 : weight);
          s.loadMode = LiftOS.Gym?.defaultLoadMode(pe.exerciseId) || (bw ? "bodyweight" : "external");
          sets.push(s);
        }
        return {
          id: uid("ex"),
          exerciseId: pe.exerciseId,
          name: master?.name || pe.exerciseId,
          muscle: master?.muscleLabel || "",
          supersetGroup: pe.supersetGroup || undefined,
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
      source: "plan",
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

  /** Core: mark set complete. Must have real reps (or duration). RIR optional. */
  function completeSet(session, setIdx, payload) {
    const ex = currentEx(session);
    if (!ex) return { ok: false, error: "no exercise" };
    const set = ex.sets[setIdx];
    if (!set) return { ok: false, error: "no set" };

    if (payload?.weight != null) set.weight = payload.weight;
    if (payload?.reps != null) set.reps = payload.reps;
    if (payload?.rir !== undefined) set.rir = payload.rir;
    if (payload?.durationSec !== undefined) set.durationSec = payload.durationSec;
    if (payload?.type) set.type = payload.type;
    if (payload?.loadMode) set.loadMode = payload.loadMode;
    if (payload?.assistanceKg !== undefined) set.assistanceKg = payload.assistanceKg;
    if (payload?.addedWeightKg !== undefined) set.addedWeightKg = payload.addedWeightKg;

    const isDuration = LiftOS.isDurationExercise?.(ex.exerciseId) || set.durationSec != null;
    if (isDuration) {
      if (set.durationSec == null || set.durationSec <= 0) {
        return { ok: false, error: "需要填写真实时长（秒）" };
      }
      set.reps = set.reps ?? null;
      if (set.weight == null) set.weight = 0;
    } else {
      if (set.reps == null || set.reps <= 0) {
        return { ok: false, error: "需要填写真实次数" };
      }
      if (set.weight == null || set.weight < 0) {
        return { ok: false, error: "需要填写重量" };
      }
      if (set.loadMode === "assisted") {
        if (set.assistanceKg == null) set.assistanceKg = set.weight ?? 0;
      }
    }

    set.completed = true;
    set.completedAt = Date.now();

    const newPrs = [];
    if (S().isWork(set) && !isDuration) {
      const liveRows = S().sessionBaseline(session, ex.exerciseId, set.id);
      if (set.loadMode === "assisted") {
        const assistedHistory = (S().exerciseHistory(ex.exerciseId, liveRows) || [])
          .flatMap((r) => r.sets.filter((x) => x.loadMode === "assisted" && x.reps));
        const cand = { assistanceKg: Number(set.assistanceKg) || 0, reps: set.reps };
        const verdict = S().assistedImprovement(cand, assistedHistory);
        if (verdict === "baseline") {
          const alreadyBaseline = session.prs?.some(
            (p) => p.exerciseId === ex.exerciseId && p.label === "Assist Baseline"
          );
          if (!alreadyBaseline) {
            newPrs.push({
              type: "assisted",
              label: "Assist Baseline",
              detail: `辅助 ${cand.assistanceKg}kg × ${set.reps}`,
            });
          }
        } else if (verdict === "pr") {
          newPrs.push({
            type: "assisted",
            label: "New Assist PR",
            detail: `辅助 ${cand.assistanceKg}kg × ${set.reps}`,
          });
        }
      } else {
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
      }
      session.prs = session.prs || [];
      newPrs.forEach((p) => {
        session.prs.push({ ...p, setId: p.setId || set.id, exerciseId: ex.exerciseId, exerciseName: ex.name });
      });
    }

    // Rest / superset navigation after completing a set
    let restSec = 0;
    let ssNav = null;
    const inSuperset = !!ex.supersetGroup && (session.exercises || []).filter((e) => e.supersetGroup === ex.supersetGroup && !e.skipped).length >= 2;

    if (inSuperset && S().isWork(set)) {
      // Interleaved cycle: A1 → B1 → (rest) → A2 → B2
      ssNav = supersetAdvance(session);
      restSec = ssNav?.restSeconds || 0;
      if (ssNav?.done) session.rest = null;
    } else if (!isLastWorkSetOfExercise(ex, setIdx)) {
      restSec = ex.planExercise?.restSeconds || St().getPrefs().restDefault || 90;
      if (set.type === "warmup") restSec = Math.min(restSec, 60);
      session.rest = { duration: restSec, endsAt: Date.now() + restSec * 1000, startedAt: Date.now() };
    } else {
      // final set of non-superset exercise → no rest
      session.rest = null;
      restSec = 0;
    }

    save(session);
    return {
      ok: true,
      prs: newPrs,
      restSeconds: restSec,
      set,
      skippedRest: restSec === 0,
      supersetSkip: !!(ssNav && restSec === 0 && !ssNav.done),
      supersetNav: ssNav,
    };
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
      const s = makeSet("work", i + 1, bw ? 0 : weight);
      s.loadMode = LiftOS.Gym?.defaultLoadMode(exerciseId) || (bw ? "bodyweight" : "external");
      LiftOS.Gym?.normalizeSetLoad(s, exerciseId);
      sets.push(s);
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
      const s = makeSet("work", i + 1, bw ? 0 : weight);
      s.loadMode = LiftOS.Gym?.defaultLoadMode(newExerciseId) || (bw ? "bodyweight" : "external");
      LiftOS.Gym?.normalizeSetLoad(s, newExerciseId);
      sets.push(s);
    }

    const idx = session.exIndex;
    const oldGroup = ex.supersetGroup;
    const members = session.exercises.filter((e) => e.supersetGroup === oldGroup && !e.skipped);
    // Orphan cleanup: new exercise inherits group only if at least one other member remains; else unlink all
    let supersetGroup;
    if (oldGroup) {
      const others = session.exercises.filter((e, i) => e.supersetGroup === oldGroup && i !== idx);
      if (others.length >= 1) {
        supersetGroup = oldGroup;
        // clear group from any remaining orphan single members after replace
        others.forEach((o) => {
          if (!o.supersetGroup) o.supersetGroup = oldGroup;
        });
      } else {
        session.exercises.forEach((e) => {
          if (e.supersetGroup === oldGroup) delete e.supersetGroup;
        });
      }
    }
    session.exercises[idx] = {
      id: uid("ex"),
      exerciseId: newExerciseId,
      name: master.name,
      muscle: master.muscleLabel,
      supersetGroup,
      planExercise: pe,
      sets,
      skipped: false,
      advice,
      notes: St().getNote(newExerciseId),
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

  /**
   * Superset cycle: after finishing a set on current exercise,
   * if next partner in group has an incomplete set → focus it (no rest).
   * If round completed (all members' next index done) → one rest, then first member with remaining sets.
   */
  function supersetAdvance(session) {
    const ex = currentEx(session);
    const group = ex?.supersetGroup;
    if (!group) return null;
    const members = session.exercises.filter((e) => e.supersetGroup === group && !e.skipped);
    if (members.length < 2) return null;
    const gi = members.indexOf(ex);
    if (gi < 0) return null;

    // Prefer next member in order
    for (let k = 1; k <= members.length; k++) {
      const nxt = members[(gi + k) % members.length];
      if (nxt === ex && k === members.length) break;
      const active = nxt.sets.findIndex((s) => !s.completed && S().isWork(s));
      if (active < 0) continue;
      // completing the later partner in the cycle → round rest before next round start
      const isLaterPartner = (gi + k) % members.length > gi || k > 1;
      // After B (later in pair) finishes a set, if A still has sets → rest then A
      // After A finishes a set and B has sets → no rest, go B
      let restSec = 0;
      const willRest = isLaterPartner && k === 1; // moved to immediate next partner → no rest
      // Determine: if we're wrapping back to an earlier member (next round) → rest
      const wrapped = (gi + k) % members.length <= gi;
      if (wrapped) {
        restSec = ex.planExercise?.restSeconds || St().getPrefs().restDefault || 90;
        session.rest = {
          duration: restSec,
          endsAt: Date.now() + restSec * 1000,
          startedAt: Date.now(),
        };
      } else {
        session.rest = null;
        restSec = 0;
      }
      session.exIndex = session.exercises.indexOf(nxt);
      save(session);
      return { movedTo: nxt.name, exerciseId: nxt.exerciseId, restSeconds: restSec, wrapped };
    }
    session.rest = null;
    save(session);
    return { done: true };
  }

  function hasActiveSuperset(session) {
    const ex = currentEx(session);
    return !!(ex?.supersetGroup && isSupersetWithNext(session));
  }

  function nextExercise(session) {
    if (session.exIndex >= session.exercises.length - 1) return false;
    session.exIndex += 1;
    session.rest = null;
    save(session);
    return true;
  }

  /** Link current exercise with the next one as a superset pair. */
  function linkSuperset(session) {
    const i = session.exIndex;
    const a = session.exercises[i];
    const b = session.exercises[i + 1];
    if (!a || !b) return { ok: false, error: "没有下一个动作" };
    const gid = a.supersetGroup || b.supersetGroup || `ss_${uid("g")}`;
    a.supersetGroup = gid;
    b.supersetGroup = gid;
    save(session);
    return { ok: true, group: gid };
  }

  function unlinkSuperset(session) {
    const a = session.exercises[session.exIndex];
    if (!a?.supersetGroup) return false;
    const gid = a.supersetGroup;
    session.exercises.forEach((ex) => {
      if (ex.supersetGroup === gid) delete ex.supersetGroup;
    });
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

  /** Free / ad-hoc workout — empty session, no fake plan. */
  function createFreeSession() {
    return {
      id: uid("ws"),
      planId: null,
      planName: "自由训练",
      source: "free",
      startTime: Date.now(),
      endTime: null,
      exIndex: 0,
      exercises: [],
      prs: [],
      rest: null,
      feeling: null,
      note: "",
      version: 3,
    };
  }

  function renumberSets(ex) {
    let n = 0;
    ex.sets.forEach((s) => {
      if (s.type === "warmup") s.num = 0;
      else {
        n += 1;
        s.num = n;
      }
    });
  }

  function addSet(session, setIdx, type = "work") {
    const ex = currentEx(session);
    if (!ex) return false;
    const lm = LiftOS.Gym?.defaultLoadMode(ex.exerciseId) || "external";
    const s = makeSet(type, 0, ex.sets.find((x) => x.weight != null)?.weight ?? null);
    s.loadMode = lm;
    const at = setIdx == null ? ex.sets.length : Math.max(0, Math.min(ex.sets.length, setIdx));
    ex.sets.splice(at, 0, s);
    renumberSets(ex);
    save(session);
    return true;
  }

  function deleteSet(session, setIdx) {
    const ex = currentEx(session);
    if (!ex || !ex.sets[setIdx]) return { ok: false, error: "no set" };
    const set = ex.sets[setIdx];
    if (set.completed) return { ok: false, error: "completed_set_requires_confirm" };
    ex.sets.splice(setIdx, 1);
    renumberSets(ex);
    save(session);
    return { ok: true };
  }

  /** Replay remaining completed sets against history baseline to rebuild session PRs. */
  function recalculateSessionPRs(session) {
    session.prs = [];
    (session.exercises || []).forEach((ex) => {
      if (ex.skipped) return;
      (ex.sets || []).forEach((set) => {
        if (!set.completed || !S().isWork(set)) return;
        if (set.durationSec != null && set.reps == null) return;
        const liveRows = S().sessionBaseline(session, ex.exerciseId, set.id);
          if (set.loadMode === "assisted") {
            const assistedHistory = (S().exerciseHistory(ex.exerciseId, liveRows) || [])
              .flatMap((r) => r.sets.filter((x) => x.loadMode === "assisted" && x.reps));
            const cand = { assistanceKg: Number(set.assistanceKg) || 0, reps: set.reps };
            const verdict = S().assistedImprovement(cand, assistedHistory);
            const alreadyBaseline = session.prs.some(
              (p) => p.exerciseId === ex.exerciseId && p.label === "Assist Baseline"
            );
            if (verdict === "baseline" && !alreadyBaseline) {
              session.prs.push({
                type: "assisted",
                label: "Assist Baseline",
                detail: `辅助 ${cand.assistanceKg}kg × ${set.reps}`,
                setId: set.id,
                exerciseId: ex.exerciseId,
                exerciseName: ex.name,
              });
            } else if (verdict === "pr") {
              session.prs.push({
                type: "assisted",
                label: "New Assist PR",
                detail: `辅助 ${cand.assistanceKg}kg × ${set.reps}`,
                setId: set.id,
                exerciseId: ex.exerciseId,
                exerciseName: ex.name,
              });
            }
          } else {
          const prior = S().detectSetPRs(ex.exerciseId, set, liveRows);
          prior.forEach((p) => {
            session.prs.push({
              ...p,
              setId: set.id,
              exerciseId: ex.exerciseId,
              exerciseName: ex.name,
            });
          });
        }
      });
    });
    save(session);
    return session.prs;
  }

  function deleteCompletedSet(session, setIdx) {
    const ex = currentEx(session);
    if (!ex || !ex.sets[setIdx]) return { ok: false, error: "no set" };
    const set = ex.sets[setIdx];
    if (!set.completed) return { ok: false, error: "not completed" };
    ex.sets.splice(setIdx, 1);
    renumberSets(ex);
    recalculateSessionPRs(session);
    save(session);
    return { ok: true, prs: session.prs };
  }

  /** Copy immediately previous completed set in this exercise into current set. */
  function copyPreviousCompletedSet(session, setIdx) {
    const ex = currentEx(session);
    if (!ex || !ex.sets[setIdx]) return { ok: false, error: "no set" };
    const prev = ex.sets.slice(0, setIdx).reverse().find((s) => s.completed);
    if (!prev) return { ok: false, error: "no previous completed set" };
    const cur = ex.sets[setIdx];
    // copy load/reps/rir only — keep semantic set type (work/amrap/failure...)
    cur.weight = prev.weight;
    cur.reps = prev.reps;
    cur.rir = prev.rir;
    cur.durationSec = prev.durationSec;
    cur.loadMode = prev.loadMode;
    cur.assistanceKg = prev.assistanceKg;
    cur.addedWeightKg = prev.addedWeightKg;
    save(session);
    return { ok: true, copied: cur };
  }

  /** Copy matching prior-workout set (same exercise work index). */
  function copyPriorWorkoutSet(session, setIdx, preference = "same_routine") {
    const ex = currentEx(session);
    if (!ex || !ex.sets[setIdx]) return { ok: false, error: "no set" };
    const workIdx = ex.sets.slice(0, setIdx).filter((s) => S().isWork(s)).length;
    const prev = LiftOS.Gym.previousSetForIndex(ex.exerciseId, workIdx, preference, session);
    if (!prev) return { ok: false, error: "上次无对应组" };
    const cur = ex.sets[setIdx];
    cur.weight = prev.weight ?? cur.weight;
    cur.reps = prev.reps ?? null;
    cur.rir = prev.rir ?? null;
    cur.durationSec = prev.durationSec ?? null;
    cur.loadMode = prev.loadMode || cur.loadMode;
    cur.assistanceKg = prev.assistanceKg ?? null;
    cur.addedWeightKg = prev.addedWeightKg ?? null;
    save(session);
    return { ok: true, copied: prev };
  }

  function setSetType(session, setIdx, type) {
    const ex = currentEx(session);
    if (!ex || !ex.sets[setIdx]) return false;
    ex.sets[setIdx].type = type;
    renumberSets(ex);
    save(session);
    return true;
  }

  function updateHistoryEntry(entry) {
    const hist = St().getHistory();
    const i = hist.findIndex((h) => h.id === entry.id);
    if (i < 0) return false;
    let volume = 0;
    let workSets = 0;
    (entry.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        if (S().isWork(s)) {
          workSets += 1;
          volume += S().setVolume(s);
        }
      });
    });
    entry.volume = Math.round(volume);
    entry.workSets = workSets;
    // Pure rebuild: baseline excludes this entry; replay sets in order
    const baselineHistory = hist.filter((h) => h.id !== entry.id);
    entry.prs = S().rebuildEntryPRs(entry, baselineHistory);
    hist[i] = entry;
    St().saveHistory(hist);
    return true;
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
      source: session.source || (session.planId ? "plan" : "free"),
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
              durationSec: s.durationSec ?? null,
              loadMode: s.loadMode || "external",
              assistanceKg: s.assistanceKg ?? null,
              addedWeightKg: s.addedWeightKg ?? null,
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
    createFreeSession,
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
    linkSuperset,
    unlinkSuperset,
    isSupersetWithNext,
    supersetAdvance,
    hasActiveSuperset,
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
    addSet,
    deleteSet,
    deleteCompletedSet,
    recalculateSessionPRs,
    copyPreviousCompletedSet,
    copyPriorWorkoutSet,
    setSetType,
    updateHistoryEntry,
    renumberSets,
  };
})();
