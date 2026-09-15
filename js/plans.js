/* WorkoutPlan CRUD with localStorage. */

window.LiftOS = window.LiftOS || {};

LiftOS.Plans = (() => {
  const St = () => LiftOS.Storage;

  function all() {
    return St().getPlans();
  }

  function get(id) {
    return all().find((p) => p.id === id) || null;
  }

  function saveAll(plans) {
    St().savePlans(plans);
  }

  function create({ name, muscleLabel = "", exercises = [] }) {
    const now = Date.now();
    const plan = {
      id: LiftOS.Workout.uid("plan"),
      name: name || "新计划",
      muscleLabel,
      createdAt: now,
      updatedAt: now,
      exercises: exercises.map((e, i) => ({
        exerciseId: e.exerciseId,
        order: i,
        workSets: e.workSets ?? 3,
        repMin: e.repMin ?? 8,
        repMax: e.repMax ?? 12,
        targetRirMin: e.targetRirMin ?? 1,
        targetRirMax: e.targetRirMax ?? 2,
        restSeconds: e.restSeconds ?? 90,
        progressionRuleId: e.progressionRuleId || "double",
      })),
    };
    const plans = all();
    plans.push(plan);
    saveAll(plans);
    return plan;
  }

  function update(planId, patch) {
    const plans = all();
    const i = plans.findIndex((p) => p.id === planId);
    if (i < 0) return null;
    plans[i] = { ...plans[i], ...patch, updatedAt: Date.now() };
    if (patch.exercises) {
      plans[i].exercises = patch.exercises.map((e, idx) => ({
        exerciseId: e.exerciseId,
        order: e.order ?? idx,
        workSets: e.workSets ?? 3,
        repMin: e.repMin ?? 8,
        repMax: e.repMax ?? 12,
        targetRirMin: e.targetRirMin ?? 1,
        targetRirMax: e.targetRirMax ?? 2,
        restSeconds: e.restSeconds ?? 90,
        progressionRuleId: e.progressionRuleId || "double",
      }));
    }
    saveAll(plans);
    return plans[i];
  }

  function remove(planId) {
    const plans = all().filter((p) => p.id !== planId);
    saveAll(plans);
  }

  function resolvePlanExerciseParams(exerciseId, params = {}) {
    const master = LiftOS.getExercise(exerciseId);
    const d = master?.defaultParams || {
      workSets: 3,
      repMin: 8,
      repMax: 12,
      targetRirMin: 1,
      targetRirMax: 2,
      restSeconds: 90,
    };
    return {
      workSets: params.workSets ?? d.workSets,
      repMin: params.repMin ?? d.repMin,
      repMax: params.repMax ?? d.repMax,
      targetRirMin: params.targetRirMin ?? d.targetRirMin,
      targetRirMax: params.targetRirMax ?? d.targetRirMax,
      restSeconds: params.restSeconds ?? d.restSeconds,
    };
  }

  function addExercise(planId, exerciseId, params = {}) {
    const plan = get(planId);
    if (!plan) return null;
    const list = plan.exercises.slice();
    const pe = resolvePlanExerciseParams(exerciseId, params);
    list.push({
      exerciseId,
      order: list.length,
      ...pe,
      progressionRuleId: "double",
    });
    return update(planId, { exercises: list });
  }

  function removeExercise(planId, index) {
    const plan = get(planId);
    if (!plan) return null;
    const list = plan.exercises.filter((_, i) => i !== index);
    return update(planId, { exercises: list });
  }

  /** Estimated duration from rest + set count heuristic. */
  function estimateMinutes(plan) {
    const sets = plan.exercises.reduce((a, e) => a + e.workSets + 1, 0);
    const rest = plan.exercises.reduce((a, e) => a + e.restSeconds * e.workSets, 0);
    return Math.round((sets * 0.7 + rest / 60 + 8) * 10) / 10;
  }

  function planStats(plan) {
    return {
      exerciseCount: plan.exercises.length,
      workSets: plan.exercises.reduce((a, e) => a + e.workSets, 0),
      minutes: estimateMinutes(plan),
    };
  }

  function muscleLabelFromPlan(plan) {
    if (plan.muscleLabel) return plan.muscleLabel;
    const set = new Set();
    plan.exercises.forEach((pe) => {
      const m = LiftOS.getExercise(pe.exerciseId);
      m?.primaryMuscles?.forEach((x) => set.add(LiftOS.MuscleLabels[x] || x));
    });
    return [...set].join(" · ") || "力量训练";
  }

  return { all, get, create, update, remove, addExercise, removeExercise, resolvePlanExerciseParams, planStats, estimateMinutes, muscleLabelFromPlan };
})();
