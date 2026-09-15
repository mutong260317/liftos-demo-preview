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

  /**
   * Canonical load-mode invariant:
   * external: weight = external load; assistance/added null
   * bodyweight: weight = 0; assistance/added null
   * added_weight: addedWeightKg canonical; weight mirrors it
   * assisted: assistanceKg only (weight mirrors for display); not lifted load
   */
  function normalizeSetLoad(set, exerciseId) {
    const mode = set.loadMode || defaultLoadMode(exerciseId);
    set.loadMode = mode;
    if (set.durationSec == null) set.durationSec = null;
    if (mode === "bodyweight") {
      set.weight = 0;
      set.assistanceKg = null;
      set.addedWeightKg = null;
      return set;
    }
    if (mode === "added_weight") {
      if (set.addedWeightKg == null) set.addedWeightKg = Number(set.weight) || 0;
      set.weight = Number(set.addedWeightKg) || 0;
      set.assistanceKg = null;
      return set;
    }
    if (mode === "assisted") {
      if (set.assistanceKg == null) set.assistanceKg = Number(set.weight) || 0;
      set.weight = Number(set.assistanceKg) || 0;
      set.addedWeightKg = null;
      return set;
    }
    if (set.weight == null) set.weight = 0;
    set.assistanceKg = null;
    set.addedWeightKg = null;
    return set;
  }

  function inferLegacyLoadMode(exerciseId, set) {
    const m = LiftOS.getExercise(exerciseId);
    const w = Number(set?.weight) || 0;
    if (m?.metricType === "duration") return "bodyweight";
    if (m?.equipment === "bodyweight") {
      return w > 0 ? "added_weight" : "bodyweight";
    }
    return "external";
  }

  function applyLegacySetFields(exerciseId, set) {
    if (!set.type) set.type = "work";
    if (set.durationSec == null) set.durationSec = null;
    if (!set.loadMode) set.loadMode = inferLegacyLoadMode(exerciseId, set);
    if (set.loadMode === "added_weight" && set.addedWeightKg == null) {
      set.addedWeightKg = Number(set.weight) || 0;
    }
    if (set.assistanceKg == null) set.assistanceKg = null;
    return normalizeSetLoad(set, exerciseId);
  }

  /** True nearest achievable plate total (DP). */
  function plateLoad(totalWeight, barWeight = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
    if (!(totalWeight > 0) || !(barWeight > 0)) {
      return { ok: false, error: "请输入有效重量" };
    }
    if (totalWeight < barWeight - 1e-9) {
      return { ok: false, error: "目标低于杠铃自重", nearest: barWeight, perSide: [] };
    }
    const step = 0.25;
    const targetSide = (totalWeight - barWeight) / 2;
    const maxSteps = Math.ceil(targetSide / step) + 200;
    const reachable = new Uint8Array(maxSteps + 1);
    reachable[0] = 1;
    for (const p of plates) {
      const units = Math.round(p / step);
      for (let i = units; i <= maxSteps; i++) {
        if (reachable[i - units]) reachable[i] = 1;
      }
    }
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i <= maxSteps; i++) {
      if (!reachable[i]) continue;
      const total = barWeight + i * step * 2;
      const dist = Math.abs(total - totalWeight);
      if (dist < bestDist - 1e-9) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const perSideTarget = bestIdx * step;
    let left = perSideTarget;
    const out = [];
    for (const p of plates) {
      while (left >= p - 1e-9) {
        out.push(p);
        left = Math.round((left - p) * 100) / 100;
      }
    }
    const achieved = Math.round((barWeight + perSideTarget * 2) * 100) / 100;
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
    normalizeSetLoad,
    inferLegacyLoadMode,
    applyLegacySetFields,
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
