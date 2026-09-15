/* V0.3 gym helpers: previous values, load modes, duration, wake lock, calculators. */

window.LiftOS = window.LiftOS || {};

LiftOS.Gym = (() => {
  const LOAD_MODES = ["external", "bodyweight", "added_weight", "assisted"];
  const SET_TYPES = ["warmup", "work", "drop", "failure", "amrap"];

  function defaultLoadMode(exerciseId) {
    const m = LiftOS.getExercise(exerciseId);
    if (!m) return "external";
    if (m.metricType === "duration") return "bodyweight";
    if (m.equipment === "bodyweight") return "bodyweight";
    return "external";
  }

  /** Prior workout's completed work sets for an exercise (not current session). */
  function priorWorkoutSets(exerciseId, preference = "same_routine", currentSession = null) {
    const rows = LiftOS.Stats.exerciseHistory(exerciseId, []);
    // exerciseHistory already returns history + extra; exclude live by not passing session
    const usable = rows.filter((r) => {
      if (!r.sets?.length) return false;
      if (preference === "same_routine" && currentSession?.planId && r.planName) {
        // soft match plan name when available
        if (r.planName && currentSession.planName && r.planName !== currentSession.planName) {
          return false;
        }
      }
      return true;
    });
    return usable[0]?.sets?.filter((s) => (s.type || "work") !== "warmup") || [];
  }

  function previousSetForIndex(exerciseId, workIndex, preference, currentSession) {
    const prev = priorWorkoutSets(exerciseId, preference, currentSession);
    return prev[workIndex] || null;
  }

  function formatLoad(set) {
    if (!set) return "—";
    if (set.durationSec != null && set.reps == null) return `${set.durationSec}s`;
    const mode = set.loadMode || "external";
    if (mode === "bodyweight") {
      return set.reps != null ? `自重 × ${set.reps}` : "自重";
    }
    if (mode === "added_weight") {
      const add = set.addedWeightKg ?? set.weight ?? 0;
      return `自重 +${add}kg × ${set.reps ?? "—"}`;
    }
    if (mode === "assisted") {
      return `辅助 ${set.assistanceKg ?? 0}kg × ${set.reps ?? "—"}`;
    }
    if (set.reps != null) return `${set.weight}kg × ${set.reps}`;
    return `${set.weight ?? "—"}kg`;
  }

  function formatPrev(set) {
    if (!set) return "—";
    return formatLoad(set);
  }

  /** Screen Wake Lock — only during active workout; never throw into UI. */
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if (!("wakeLock" in navigator)) return { ok: false, reason: "unsupported" };
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) };
    }
  }
  async function releaseWakeLock() {
    try {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /**
   * Warm-up sets from target working weight.
   * Defaults: 40%×8, 60%×5, 80%×3; round to increment.
   */
  function buildWarmupPlan(targetWeight, increment = 2.5, template = null) {
    const tpls = template || [
      { pct: 0.4, reps: 8 },
      { pct: 0.6, reps: 5 },
      { pct: 0.8, reps: 3 },
    ];
    const inc = increment > 0 ? increment : 2.5;
    return tpls.map((t) => {
      const raw = targetWeight * t.pct;
      const w = Math.max(inc, Math.round(raw / inc) * inc);
      return { type: "warmup", weight: w, reps: t.reps, rir: null };
    });
  }

  /** Plate loading per side. barWeight default 20. plates descending. */
  function plateLoad(totalWeight, barWeight = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
    if (totalWeight < barWeight) {
      return { ok: false, error: "目标低于杠铃自重", nearest: barWeight, perSide: [] };
    }
    let perSide = (totalWeight - barWeight) / 2;
    // snap to 0.25
    perSide = Math.round(perSide * 4) / 4;
    const remaining = perSide;
    const out = [];
    let left = remaining;
    for (const p of plates) {
      while (left >= p - 1e-9) {
        out.push(p);
        left = Math.round((left - p) * 1000) / 1000;
      }
    }
    const built = out.reduce((a, b) => a + b, 0);
    const achieved = Math.round((barWeight + built * 2) * 100) / 100;
    const exact = Math.abs(achieved - totalWeight) < 0.01;
    return {
      ok: true,
      exact,
      perSide: out,
      achieved,
      nearest: achieved,
      error: exact ? null : "无法精确凑出目标重量，已给出最接近可装片重量",
    };
  }

  return {
    LOAD_MODES,
    SET_TYPES,
    defaultLoadMode,
    priorWorkoutSets,
    previousSetForIndex,
    formatLoad,
    formatPrev,
    requestWakeLock,
    releaseWakeLock,
    buildWarmupPlan,
    plateLoad,
  };
})();
