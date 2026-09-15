/* Stats: e1RM, volume, PR types, dashboard range filters. */

window.LiftOS = window.LiftOS || {};

LiftOS.Stats = (() => {
  /** Epley. Prefer 1–12 reps; >15 is weak signal. */
  function e1RM(weight, reps) {
    if (!weight || !reps || reps <= 0) return null;
    return weight * (1 + reps / 30);
  }

  function e1RMConfidence(reps) {
    if (!reps || reps <= 0) return 0;
    if (reps >= 1 && reps <= 12) return 1;
    if (reps <= 15) return 0.6;
    return 0.25;
  }

  function isWork(set) {
    return !set.type || set.type === "work" || set.type === "failure" || set.type === "drop";
  }

  function isWarmup(set) {
    return set.type === "warmup";
  }

  function setVolume(set) {
    if (!isWork(set)) return 0;
    const w = Number(set.weight) || 0;
    const r = Number(set.reps) || 0;
    return w * r;
  }

  function sessionVolume(session) {
    if (!session) return 0;
    let v = 0;
    (session.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        if (s.completed) v += setVolume(s);
      });
    });
    return Math.round(v);
  }

  function workSetCount(session) {
    if (!session) return 0;
    let n = 0;
    (session.exercises || []).forEach((ex) => {
      if (ex.skipped) return;
      (ex.sets || []).forEach((s) => {
        if (isWork(s) && s.completed) n += 1;
      });
    });
    return n;
  }

  function completedExerciseCount(session) {
    if (!session) return 0;
    return (session.exercises || []).filter((ex) => {
      if (ex.skipped) return false;
      const work = (ex.sets || []).filter(isWork);
      return work.length > 0 && work.every((s) => s.completed);
    }).length;
  }

  function avgRir(session) {
    const vals = [];
    (session?.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        if (isWork(s) && s.completed && s.rir != null && s.rir !== "") vals.push(Number(s.rir));
      });
    });
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }

  function muscleWorkSets(session) {
    const map = {};
    (session?.exercises || []).forEach((ex) => {
      if (ex.skipped) return;
      const master = LiftOS.getExercise(ex.exerciseId);
      const muscles = master ? master.primaryMuscles : ["other"];
      const n = (ex.sets || []).filter((s) => isWork(s) && s.completed).length;
      if (!n) return;
      muscles.forEach((m) => {
        map[m] = (map[m] || 0) + n;
      });
    });
    return map;
  }

  /** Aggregate history + optional live session for an exercise. */
  function exerciseHistory(exerciseId, extraSessions = []) {
    const history = LiftOS.Storage.getHistory();
    const rows = [];
    history.forEach((h) => {
      (h.exercises || []).forEach((ex) => {
        if (ex.exerciseId !== exerciseId) return;
        rows.push({
          date: h.date,
          planName: h.planName,
          sets: (ex.sets || []).filter(isWork),
        });
      });
    });
    extraSessions.forEach((s) => {
      (s.exercises || []).forEach((ex) => {
        if (ex.exerciseId !== exerciseId) return;
        const work = (ex.sets || []).filter((x) => isWork(x) && x.completed);
        if (!work.length) return;
        rows.unshift({
          date: new Date(s.startTime || Date.now()).toISOString().slice(0, 10),
          planName: s.planName,
          sets: work.map((x) => ({ type: x.type, weight: x.weight, reps: x.reps, rir: x.rir })),
        });
      });
    });
    return rows;
  }

  function bestSet(exerciseId, extraSessions = []) {
    const rows = exerciseHistory(exerciseId, extraSessions);
    const isBW = LiftOS.isBodyweight(exerciseId);
    let best = null;
    rows.forEach((r) => {
      r.sets.forEach((s) => {
        if (s.reps == null || s.reps <= 0) return;
        // bodyweight allows weight=0; loaded lifts require positive weight
        if (s.weight == null || (!isBW && s.weight <= 0)) return;
        if (isBW && s.weight < 0) return;
        if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) {
          best = { weight: s.weight, reps: s.reps, date: r.date };
        }
      });
    });
    return best;
  }

  function bestE1RM(exerciseId, extraSessions = []) {
    const master = LiftOS.getExercise(exerciseId);
    if (master && master.supportsE1RM === false) return null;
    if (master && master.equipment === "bodyweight") return null;
    const rows = exerciseHistory(exerciseId, extraSessions);
    let best = null;
    rows.forEach((r) => {
      r.sets.forEach((s) => {
        if (s.reps == null || s.reps <= 0 || s.weight == null || s.weight <= 0) return;
        const conf = e1RMConfidence(s.reps);
        if (conf < 0.5) return;
        const val = e1RM(s.weight, s.reps);
        if (!best || val > best.e1rm) {
          best = { e1rm: val, weight: s.weight, reps: s.reps, date: r.date };
        }
      });
    });
    return best;
  }

  function exerciseVolumeOn(exerciseId, sets) {
    return sets.filter(isWork).reduce((a, s) => a + setVolume(s), 0);
  }

  function bestVolume(exerciseId, extraSessions = []) {
    const rows = exerciseHistory(exerciseId, extraSessions);
    let best = null;
    rows.forEach((r) => {
      const v = exerciseVolumeOn(exerciseId, r.sets);
      if (v > 0 && (!best || v > best.volume)) best = { volume: v, date: r.date };
    });
    return best;
  }

  /**
   * Detect PRs from a just-completed work set.
   * Returns array of { type, label, detail }
   */
  function detectSetPRs(exerciseId, set, extraSessions = []) {
    const results = [];
    // bodyweight / zero-load: no weight/e1RM PR; reps PR still possible when weight matches (0)
    if (!set || !isWork(set) || !set.completed || set.reps == null || set.reps <= 0) return results;
    const master = LiftOS.getExercise(exerciseId);
    const isBW = master?.equipment === "bodyweight";
    if (!isBW && (set.weight == null || set.weight <= 0)) return results;

    const priorBest = bestSet(exerciseId, extraSessions);
    if (!priorBest || set.weight > priorBest.weight) {
      if (!isBW && set.weight > 0) {
        results.push({
          type: "weight",
          label: "New Weight PR",
          detail: `${set.weight}kg × ${set.reps}`,
        });
      } else if (isBW && set.weight > 0) {
        results.push({
          type: "weight",
          label: "New Load PR",
          detail: `+${set.weight}kg × ${set.reps}`,
        });
      }
    } else if (set.weight === priorBest.weight && set.reps > priorBest.reps) {
      results.push({
        type: "reps",
        label: "New Rep PR",
        detail: isBW && !set.weight ? `${set.reps} 次` : `${set.weight}kg × ${set.reps}`,
      });
    }

    if (!isBW && master?.supportsE1RM !== false) {
      const conf = e1RMConfidence(set.reps);
      if (conf >= 0.5 && set.weight > 0) {
        const val = e1RM(set.weight, set.reps);
        const priorE = bestE1RM(exerciseId, extraSessions);
        if (!priorE || val > priorE.e1rm + 0.05) {
          results.push({
            type: "e1rm",
            label: "New e1RM PR",
            detail: `${val.toFixed(1)}kg`,
          });
        }
      }
    }

    return results;
  }

  function detectVolumePR(exerciseId, sets, extraSessions = []) {
    const vol = exerciseVolumeOn(exerciseId, sets.filter((s) => s.completed));
    if (vol <= 0) return null;
    const prior = bestVolume(exerciseId, extraSessions);
    if (!prior || vol > prior.volume) {
      return { type: "volume", label: "New Volume PR", detail: `${vol.toLocaleString()} kg` };
    }
    return null;
  }

  /** date is ISO yyyy-mm-dd or ms */
  function inRange(dateStr, range) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === "all") return true;
    if (range === "7d") return d >= new Date(startOfToday.getTime() - 6 * 86400000);
    if (range === "30d") return d >= new Date(startOfToday.getTime() - 29 * 86400000);
    if (range === "3m") return d >= new Date(startOfToday.getTime() - 89 * 86400000);
    if (range === "1y") return d >= new Date(startOfToday.getTime() - 364 * 86400000);
    return true;
  }

  function historyIn(range) {
    return LiftOS.Storage.getHistory().filter((h) => inRange(h.date, range));
  }

  function summarizeHistory(range = "30d") {
    const rows = historyIn(range);
    let volume = 0;
    let workSets = 0;
    let minutes = 0;
    let prs = 0;
    const byExercise = {};

    rows.forEach((h) => {
      minutes += h.durationMinutes || estimateMinutes(h);
      (h.exercises || []).forEach((ex) => {
        const id = ex.exerciseId;
        if (!byExercise[id]) byExercise[id] = { weight: 0, reps: 0, e1rm: 0, volume: 0 };
        (ex.sets || []).forEach((s) => {
          if (!isWork(s)) return;
          volume += setVolume(s);
          workSets += 1;
          if (s.weight > byExercise[id].weight) byExercise[id].weight = s.weight;
          if (s.reps > byExercise[id].reps) byExercise[id].reps = s.reps;
          const e = e1RM(s.weight, s.reps);
          if (e && e > byExercise[id].e1rm) byExercise[id].e1rm = e;
          byExercise[id].volume += setVolume(s);
        });
      });
      if (h.prs) prs += h.prs;
      else prs += countSeedPRs(h);
    });

    return {
      sessions: rows.length,
      volume: Math.round(volume),
      workSets,
      minutes: Math.round(minutes),
      prs,
      rows,
      byExercise,
    };
  }

  function estimateMinutes(h) {
    const sets = (h.exercises || []).reduce((a, ex) => a + (ex.sets || []).length, 0);
    return Math.max(20, Math.round(sets * 2.5));
  }

  function countSeedPRs(h) {
    // rough: sessions that contain hack_squat at 105+ or bench 80 count as pr-bearing seed days
    let n = 0;
    (h.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        if (ex.exerciseId === "hack_squat" && s.weight >= 105) n += 1;
        if (ex.exerciseId === "bench" && s.weight >= 80) n += 1;
      });
    });
    return Math.min(n, 2);
  }

  function weeklyMuscleSets(range = "7d") {
    const map = {};
    historyIn(range).forEach((h) => {
      (h.exercises || []).forEach((ex) => {
        const master = LiftOS.getExercise(ex.exerciseId);
        const muscles = master ? master.primaryMuscles : ["other"];
        const n = (ex.sets || []).filter(isWork).length;
        muscles.forEach((m) => {
          map[m] = (map[m] || 0) + n;
        });
      });
    });
    return map;
  }

  function e1rmSeries(exerciseId, extraSessions = [], range = "all") {
    const rows = exerciseHistory(exerciseId, extraSessions)
      .filter((r) => inRange(r.date, range))
      .slice()
      .reverse();
    const master = LiftOS.getExercise(exerciseId);
    if (master && master.supportsE1RM === false) {
      return rows.map((r) => {
        const bestW = Math.max(0, ...r.sets.map((s) => s.weight || 0));
        return { date: r.date, value: bestW };
      });
    }
    return rows.map((r) => {
      let best = 0;
      r.sets.forEach((s) => {
        const e = e1RM(s.weight, s.reps);
        if (e && e > best) best = e;
      });
      return { date: r.date, value: best };
    });
  }

  /**
   * Convert live session completed work sets (before setId) into session-shaped
   * extras so exerciseHistory/bestSet can merge them with stored history.
   */
  function sessionBaseline(session, exerciseId, beforeSetId) {
    if (!session) return [];
    const sets = [];
    (session.exercises || []).forEach((ex) => {
      if (ex.exerciseId !== exerciseId || ex.skipped) return;
      for (const s of ex.sets) {
        if (!isWork(s) || !s.completed) continue;
        if (beforeSetId && s.id === beforeSetId) break;
        sets.push({ type: s.type, weight: s.weight, reps: s.reps, rir: s.rir, completed: true });
      }
    });
    if (!sets.length) return [];
    return [
      {
        id: `live_${session.id}`,
        startTime: session.startTime,
        planName: session.planName,
        exercises: [{ exerciseId, name: "", sets }],
      },
    ];
  }

  function localDateKey(d = new Date()) {
    return LiftOS.localDateKey(d);
  }

  return {
    e1RM,
    e1RMConfidence,
    isWork,
    isWarmup,
    setVolume,
    sessionVolume,
    workSetCount,
    completedExerciseCount,
    avgRir,
    muscleWorkSets,
    exerciseHistory,
    bestSet,
    bestE1RM,
    bestVolume,
    detectSetPRs,
    detectVolumePR,
    inRange,
    historyIn,
    summarizeHistory,
    weeklyMuscleSets,
    e1rmSeries,
    sessionBaseline,
    localDateKey,
  };
})();
