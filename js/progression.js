/* Rule-based Double Progression engine. No AI. */

window.LiftOS = window.LiftOS || {};

LiftOS.Progression = (() => {
  const S = () => LiftOS.Stats;

  /**
   * Double progression:
   * - If most work sets hit repMax → increase weight
   * - If most sets below repMin → hold or decrease
   * - Else hold
   * - 3 consecutive sessions without progress → stall
   */
  function getProgressionSuggestion({ exerciseId, repMin, repMax, historyRows }) {
    const master = LiftOS.getExercise(exerciseId);
    const inc = master?.defaultIncrement ?? 2.5;
    const rows = (historyRows || S().exerciseHistory(exerciseId)).filter((r) => r.sets?.length);

    if (!rows.length) {
      return {
        action: "start",
        suggestedWeight: master?.defaultIncrement ? estimateStart(master) : 20,
        reason: "尚无该动作记录，使用轻重量建立动作模式。",
        confidence: 0.4,
      };
    }

    const last = rows[0];
    const lastWork = last.sets.filter((s) => (s.type || "work") === "work" || s.type === "failure");
    const lastWeight = Math.max(...lastWork.map((s) => s.weight || 0));
    const repsList = lastWork.map((s) => s.reps).filter((r) => r != null);

    if (!repsList.length) {
      return {
        action: "hold",
        suggestedWeight: lastWeight,
        reason: "上次没有有效次数记录，建议保持重量重新建立数据。",
        confidence: 0.4,
      };
    }

    const atCap = repsList.filter((r) => r >= repMax).length;
    const belowMin = repsList.filter((r) => r < repMin).length;
    const total = repsList.length;

    // stall: last 3 sessions same weight and best e1RM not improving
    const recent = rows.slice(0, 3);
    const weights = recent.map((r) => Math.max(...r.sets.map((s) => s.weight || 0)));
    const e1s = recent.map((r) => {
      let best = 0;
      r.sets.forEach((s) => {
        const e = S().e1RM(s.weight, s.reps);
        if (e && e > best) best = e;
      });
      return best;
    });
    const stalled =
      recent.length >= 3 &&
      weights.every((w) => w === weights[0]) &&
      e1s[0] <= e1s[1] + 0.01 &&
      e1s[1] <= e1s[2] + 0.01;

    if (stalled) {
      return {
        action: "deload",
        suggestedWeight: Math.max(0, Math.round((lastWeight * 0.9) * 10) / 10),
        reason: `最近 3 次表现变化较小，建议轻量周或减少 1 组。`,
        confidence: 0.75,
      };
    }

    if (atCap >= Math.ceil(total * 0.75) && total >= 2) {
      return {
        action: "increase",
        suggestedWeight: Math.round((lastWeight + inc) * 10) / 10,
        reason: `上次 ${repsList.join("/")} 次，多数达到目标上限 ${repMax}，建议 +${inc}kg。`,
        confidence: 0.85,
      };
    }

    if (belowMin >= Math.ceil(total * 0.75) && total >= 2) {
      const decrease = lastWeight > inc ? Math.round((lastWeight - inc) * 10) / 10 : lastWeight;
      return {
        action: decrease < lastWeight ? "decrease" : "hold",
        suggestedWeight: decrease,
        reason: `上次多数低于目标下限 ${repMin}，当前重量可能偏高。`,
        confidence: 0.8,
      };
    }

    return {
      action: "hold",
      suggestedWeight: lastWeight,
      reason: `上次次数 ${repsList.join("/")} 落在目标区间 ${repMin}-${repMax} 内，建议保持重量。`,
      confidence: 0.7,
    };
  }

  function estimateStart(master) {
    if (master.id === "incline") return 16;
    if (master.id === "hack_squat") return 60;
    if (master.id === "bench") return 40;
    return 20;
  }

  function actionLabel(action) {
    return (
      {
        increase: "建议升级",
        hold: "建议保持",
        decrease: "建议减重",
        deload: "建议轻量周",
        start: "建议起步",
      }[action] || "建议"
    );
  }

  return { getProgressionSuggestion, actionLabel };
})();
