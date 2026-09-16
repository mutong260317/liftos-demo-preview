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
    const t = set?.type;
    if (!t) return true;
    return t === "work" || t === "failure" || t === "drop" || t === "amrap";
  }

  function isWarmup(set) {
    return set?.type === "warmup";
  }

  function setVolume(set) {
    if (!isWork(set)) return 0;
    // assisted: assistance is NOT lifted load — exclude from kg tonnage
    if (set.loadMode === "assisted") return 0;
    if (set.loadMode === "added_weight") {
      return (Number(set.addedWeightKg) || Number(set.weight) || 0) * (Number(set.reps) || 0);
    }
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
  function exerciseHistory(exerciseId, extraSessions = [], historyOverride = null) {
    const history = historyOverride || LiftOS.Storage.getHistory();
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
          sets: work.map((x) => ({
            type: x.type,
            weight: x.weight,
            reps: x.reps,
            rir: x.rir,
            loadMode: x.loadMode,
            assistanceKg: x.assistanceKg,
            addedWeightKg: x.addedWeightKg,
            durationSec: x.durationSec,
          })),
        });
      });
    });
    return rows;
  }

  function bestSet(exerciseId, extraSessions = [], historyOverride = null) {
    const rows = exerciseHistory(exerciseId, extraSessions, historyOverride);
    const isBW = LiftOS.isBodyweight(exerciseId);
    let best = null;
    rows.forEach((r) => {
      r.sets.forEach((s) => {
        if (s.reps == null || s.reps <= 0) return;
        // assisted is not a strength best in kg
        if (s.loadMode === "assisted") return;
        const load = s.loadMode === "added_weight" ? Number(s.addedWeightKg) || Number(s.weight) || 0 : Number(s.weight) || 0;
        if (s.loadMode === "bodyweight" || (isBW && load === 0)) {
          if (!best || load > best.weight || (load === best.weight && s.reps > best.reps)) {
            best = { weight: 0, reps: s.reps, date: r.date, loadMode: "bodyweight" };
          }
          return;
        }
        if (load <= 0) return;
        if (!best || load > best.weight || (load === best.weight && s.reps > best.reps)) {
          best = { weight: load, reps: s.reps, date: r.date, loadMode: s.loadMode || "external" };
        }
      });
    });
    return best;
  }

  function bestE1RM(exerciseId, extraSessions = [], historyOverride = null) {
    const master = LiftOS.getExercise(exerciseId);
    if (master && master.supportsE1RM === false) return null;
    if (master && master.equipment === "bodyweight") return null;
    const rows = exerciseHistory(exerciseId, extraSessions, historyOverride);
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
  function detectSetPRs(exerciseId, set, extraSessions = [], historyOverride = null) {
    const results = [];
    if (!set || !isWork(set) || !set.completed || set.reps == null || set.reps <= 0) return results;
    const master = LiftOS.getExercise(exerciseId);
    const isBW = master?.equipment === "bodyweight";
    if (!isBW && (set.weight == null || set.weight <= 0)) return results;

    const priorBest = bestSet(exerciseId, extraSessions, historyOverride);
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
        const priorE = bestE1RM(exerciseId, extraSessions, historyOverride);
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
        if (!byExercise[id]) byExercise[id] = { weight: 0, reps: 0, e1rm: 0, volume: 0, assisted: 0 };
        (ex.sets || []).forEach((s) => {
          if (!isWork(s)) return;
          volume += setVolume(s);
          workSets += 1;
          byExercise[id].volume += setVolume(s);
          if (s.loadMode === "assisted") {
            // never treat assistance as positive strength load
            byExercise[id].assisted += 1;
            if (s.reps > byExercise[id].reps) byExercise[id].reps = s.reps;
            return;
          }
          const load =
            s.loadMode === "added_weight"
              ? Number(s.addedWeightKg) || Number(s.weight) || 0
              : Number(s.weight) || 0;
          if (load > byExercise[id].weight) byExercise[id].weight = load;
          if (s.reps > byExercise[id].reps) byExercise[id].reps = s.reps;
          if (s.loadMode !== "bodyweight" && masterSupportsE1RM(id)) {
            const e = e1RM(load, s.reps);
            if (e && e > byExercise[id].e1rm) byExercise[id].e1rm = e;
          }
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

  function masterSupportsE1RM(exerciseId) {
    const m = LiftOS.getExercise(exerciseId);
    if (!m) return true;
    return m.supportsE1RM !== false && m.equipment !== "bodyweight" && m.metricType !== "duration";
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
    if (master && (master.supportsE1RM === false || master.equipment === "bodyweight" || master.metricType === "duration")) {
      // For BW/assisted-dominant movements: trend is max non-assisted load (added weight), else 0.
      // More assistance must NOT rise the series.
      return rows.map((r) => {
        const loads = r.sets
          .filter((s) => s.loadMode !== "assisted")
          .map((s) => {
            if (s.loadMode === "added_weight") return Number(s.addedWeightKg) || Number(s.weight) || 0;
            if (s.loadMode === "bodyweight") return 0;
            return Number(s.weight) || 0;
          });
        return { date: r.date, value: loads.length ? Math.max(0, ...loads) : 0 };
      });
    }
    return rows.map((r) => {
      let best = 0;
      r.sets.forEach((s) => {
        if (s.loadMode === "assisted" || s.loadMode === "bodyweight") return;
        const load =
          s.loadMode === "added_weight"
            ? Number(s.addedWeightKg) || Number(s.weight) || 0
            : Number(s.weight) || 0;
        const e = e1RM(load, s.reps);
        if (e && e > best) best = e;
      });
      return { date: r.date, value: best };
    });
  }

  /** Weekly local review from real history only. */
  function weeklyReview(from = new Date()) {
    const prefs = LiftOS.Storage.getPrefs() || {};
    const target = prefs.weeklyTarget || 5;
    const day = from.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    const monday = new Date(from.getFullYear(), from.getMonth(), from.getDate() - mondayOffset);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const start = LiftOS.localDateKey(monday);
    const end = LiftOS.localDateKey(sunday);
    const prevMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
    const prevEnd = LiftOS.localDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1));

    const hist = LiftOS.Storage.getHistory();
    const thisWeek = hist.filter((h) => h.date >= start && h.date <= end);
    const prevWeek = hist.filter((h) => h.date >= LiftOS.localDateKey(prevMonday) && h.date <= prevEnd);

    const sumRange = (rows) => {
      let volume = 0;
      let workSets = 0;
      let prs = 0;
      rows.forEach((h) => {
        volume += h.volume != null ? h.volume : (h.exercises || []).reduce((a, ex) => a + (ex.sets || []).reduce((b, s) => b + setVolume(s), 0), 0);
        workSets += h.workSets != null ? h.workSets : (h.exercises || []).reduce((a, ex) => a + (ex.sets || []).filter(isWork).length, 0);
        prs += h.prs || 0;
      });
      return { volume: Math.round(volume), workSets, prs };
    };

    const mus = {};
    thisWeek.forEach((h) => {
      (h.exercises || []).forEach((ex) => {
        const m = LiftOS.getExercise(ex.exerciseId);
        (m?.primaryMuscles || []).forEach((k) => {
          mus[k] = (mus[k] || 0) + (ex.sets || []).filter(isWork).length;
        });
      });
    });

    const cur = sumRange(thisWeek);
    const prev = sumRange(prevWeek);
    return {
      start,
      end,
      sessions: thisWeek.length,
      workSets: cur.workSets,
      volume: cur.volume,
      prevVolume: prev.volume,
      volumeDelta: prev.volume ? Math.round(((cur.volume - prev.volume) / prev.volume) * 1000) / 10 : null,
      prs: cur.prs,
      muscleSets: mus,
      weeklyTarget: target,
      targetMet: thisWeek.length >= target,
    };
  }

  /** Compare a finished entry to previous same planName workouts. */
  function compareSameRoutine(entry) {
    if (!entry) return null;
    const hist = LiftOS.Storage.getHistory().filter((h) => {
      if (h.id === entry.id) return false;
      if (entry.planId && h.planId) return h.planId === entry.planId;
      if (!entry.planId || !h.planId) return h.planName === entry.planName;
      return false;
    });
    if (!hist.length) return null;
    const prev = hist[0];
    const vol = entry.volume ?? 0;
    const prevVol = prev.volume ?? 0;
    const sets = entry.workSets ?? 0;
    const prevSets = prev.workSets ?? 0;
    return {
      planName: entry.planName,
      planId: entry.planId || prev.planId || null,
      prevDate: prev.date,
      volume: vol,
      prevVolume: prevVol,
      volumeDeltaPct: prevVol ? Math.round(((vol - prevVol) / prevVol) * 1000) / 10 : null,
      workSets: sets,
      prevWorkSets: prevSets,
      setsDelta: sets - prevSets,
    };
  }

  /** Top exercises by work sets then load-aware volume (assisted mass excluded). */
  function topExercises(entry, limit = 3) {
    const rows = [];
    (entry?.exercises || []).forEach((ex) => {
      let workSets = 0;
      let volume = 0;
      (ex.sets || []).forEach((s) => {
        if (!isWork(s)) return;
        workSets += 1;
        volume += setVolume(s);
      });
      if (workSets) rows.push({ exerciseId: ex.exerciseId, name: ex.name, workSets, volume: Math.round(volume) });
    });
    rows.sort((a, b) => b.workSets - a.workSets || b.volume - a.volume);
    return rows.slice(0, limit);
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
        sets.push({
          type: s.type,
          weight: s.weight,
          reps: s.reps,
          rir: s.rir,
          loadMode: s.loadMode,
          assistanceKg: s.assistanceKg,
          addedWeightKg: s.addedWeightKg,
          durationSec: s.durationSec,
          completed: true,
        });
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

  /**
   * Assisted Pareto: candidate improves if it strictly dominates ≥1 prior
   * (less/equal assist + equal/better reps, one strict) AND is not dominated
   * by any prior.
   */
  function assistedDominates(a, b) {
    const aa = Number(a.assistanceKg ?? a.weight) || 0;
    const ba = Number(b.assistanceKg ?? b.weight) || 0;
    const ar = Number(a.reps) || 0;
    const br = Number(b.reps) || 0;
    if (ar <= 0 || br <= 0) return false;
    const le = aa <= ba + 1e-9;
    const ge = ar >= br - 1e-9;
    const strict = aa < ba - 1e-9 || ar > br + 1e-9;
    return le && ge && strict;
  }

  function assistedIsDominatedByAny(candidate, priors) {
    return priors.some((p) => assistedDominates(p, candidate));
  }

  function assistedWeaklyDominates(a, b) {
    const aa = Number(a.assistanceKg ?? a.weight) || 0;
    const ba = Number(b.assistanceKg ?? b.weight) || 0;
    const ar = Number(a.reps) || 0;
    const br = Number(b.reps) || 0;
    if (ar <= 0 || br <= 0) return false;
    return aa <= ba + 1e-9 && ar >= br - 1e-9;
  }

  function assistedImprovement(candidate, priors) {
    if (!priors.length) return "baseline";
    // equal or worse vs any prior → not a PR
    if (assistedIsDominatedByAny(candidate, priors)) return false;
    if (priors.some((p) => assistedWeaklyDominates(p, candidate))) return false;
    if (priors.some((p) => assistedDominates(candidate, p))) return "pr";
    return false;
  }

  /**
   * Pure PR rebuild for a history entry against an explicit baseline history
   * array (must already exclude this entry). Replays sets in order so earlier
   * corrected sets become baseline for later ones.
   */
  function rebuildEntryPRs(entry, baselineHistory) {
    let prCount = 0;
    const seen = {
      // per exerciseId running assisted set list for sequential compare
      assisted: {},
      // synthetic extra sessions built from already-replayed sets
      extra: {},
    };

    function ensureExtra(exId) {
      if (!seen.extra[exId]) {
        seen.extra[exId] = {
          id: `replay_${entry.id}_${exId}`,
          startTime: entry.startTime || Date.now(),
          planName: entry.planName,
          exercises: [{ exerciseId: exId, name: "", sets: [] }],
        };
      }
      return seen.extra[exId];
    }

    (entry.exercises || []).forEach((ex) => {
      const exId = ex.exerciseId;
      seen.assisted[exId] = (baselineHistory || [])
        .flatMap((h) => (h.exercises || [])
          .filter((e) => e.exerciseId === exId)
          .flatMap((e) => (e.sets || []).filter((s) => s.loadMode === "assisted" && s.reps)));

      (ex.sets || []).forEach((s) => {
        if (!isWork(s)) return;
        if (s.loadMode === "assisted") {
          const cand = {
            assistanceKg: s.assistanceKg ?? s.weight,
            reps: s.reps,
          };
          const priors = seen.assisted[exId] || [];
          const verdict = assistedImprovement(cand, priors);
          if (verdict === "pr") prCount += 1;
          // append this set as future prior for sequential replay
          seen.assisted[exId] = priors.concat([
            { assistanceKg: cand.assistanceKg, reps: cand.reps, weight: cand.assistanceKg, loadMode: "assisted" },
          ]);
          ensureExtra(exId).exercises[0].sets.push({
            type: s.type,
            weight: s.weight,
            reps: s.reps,
            rir: s.rir,
            loadMode: s.loadMode,
            assistanceKg: s.assistanceKg,
            addedWeightKg: s.addedWeightKg,
            completed: true,
          });
          return;
        }
        // non-assisted: compare against baselineHistory + already-replayed sets only
        const extras = Object.values(seen.extra);
        const detected = detectSetPRs(exId, { ...s, completed: true, type: s.type || "work" }, extras, baselineHistory);
        prCount += detected.length;
        ensureExtra(exId).exercises[0].sets.push({
          type: s.type,
          weight: s.weight,
          reps: s.reps,
          rir: s.rir,
          loadMode: s.loadMode,
          assistanceKg: s.assistanceKg,
          addedWeightKg: s.addedWeightKg,
          completed: true,
        });
      });
    });
    return prCount;
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
    assistedDominates,
    assistedImprovement,
    rebuildEntryPRs,
    weeklyReview,
    compareSameRoutine,
    topExercises,
  };
})();
