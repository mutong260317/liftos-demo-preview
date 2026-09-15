/* LiftOS Exercise Master + default seed data. No fabricated session values. */

window.LiftOS = window.LiftOS || {};

/** Local calendar date key — never use UTC ISO for training days. */
LiftOS.localDateKey = function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

LiftOS.daysAgo = function daysAgo(n, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - n);
  return LiftOS.localDateKey(d);
};

/** Per-exercise programming defaults (used by replace / add). */
function defParams(overrides) {
  return Object.assign(
    {
      workSets: 3,
      repMin: 8,
      repMax: 12,
      targetRirMin: 1,
      targetRirMax: 2,
      restSeconds: 90,
    },
    overrides
  );
}

LiftOS.Exercises = [
  { id: "incline", name: "上斜哑铃卧推", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"], equipment: "dumbbell", category: "compound", defaultIncrement: 2, supportsE1RM: true, muscleLabel: "胸 · 上胸", defaultParams: defParams({ workSets: 4, repMin: 8, repMax: 12, restSeconds: 120 }) },
  { id: "chest_press", name: "坐姿推胸", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: "machine", category: "compound", defaultIncrement: 5, supportsE1RM: true, muscleLabel: "胸 · 中胸", defaultParams: defParams({ workSets: 4, repMin: 8, repMax: 12, restSeconds: 120 }) },
  { id: "pec_deck", name: "蝴蝶机夹胸", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: "machine", category: "isolation", defaultIncrement: 5, supportsE1RM: false, muscleLabel: "胸 · 中缝", defaultParams: defParams({ workSets: 3, repMin: 10, repMax: 15, restSeconds: 90 }) },
  { id: "lateral", name: "哑铃侧平举", primaryMuscles: ["side_delts"], secondaryMuscles: [], equipment: "dumbbell", category: "isolation", defaultIncrement: 1, supportsE1RM: false, muscleLabel: "肩 · 中束", defaultParams: defParams({ workSets: 4, repMin: 12, repMax: 15, restSeconds: 60 }) },
  { id: "pushdown", name: "绳索下压", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: "cable", category: "isolation", defaultIncrement: 2.5, supportsE1RM: false, muscleLabel: "三头", defaultParams: defParams({ workSets: 4, repMin: 10, repMax: 15, restSeconds: 60 }) },
  { id: "hack_squat", name: "哈克深蹲", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: "machine", category: "compound", defaultIncrement: 5, supportsE1RM: true, muscleLabel: "腿 · 股四", defaultParams: defParams({ workSets: 5, repMin: 8, repMax: 12, restSeconds: 150 }) },
  { id: "leg_press", name: "腿举", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: "machine", category: "compound", defaultIncrement: 10, supportsE1RM: true, muscleLabel: "腿 · 股四臀", defaultParams: defParams({ workSets: 4, repMin: 10, repMax: 15, restSeconds: 120 }) },
  { id: "leg_ext", name: "腿屈伸", primaryMuscles: ["quads"], secondaryMuscles: [], equipment: "machine", category: "isolation", defaultIncrement: 5, supportsE1RM: false, muscleLabel: "腿 · 股四", defaultParams: defParams({ workSets: 4, repMin: 10, repMax: 15, restSeconds: 90 }) },
  { id: "leg_curl", name: "腿弯举", primaryMuscles: ["hamstrings"], secondaryMuscles: [], equipment: "machine", category: "isolation", defaultIncrement: 5, supportsE1RM: false, muscleLabel: "腿 · 腘绳肌", defaultParams: defParams({ workSets: 4, repMin: 10, repMax: 15, restSeconds: 90 }) },
  { id: "calf", name: "提踵", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: "machine", category: "isolation", defaultIncrement: 5, supportsE1RM: false, muscleLabel: "腿 · 小腿", defaultParams: defParams({ workSets: 4, repMin: 12, repMax: 20, restSeconds: 60 }) },
  { id: "crunch", name: "卷腹", primaryMuscles: ["core"], secondaryMuscles: [], equipment: "bodyweight", category: "isolation", defaultIncrement: 0, supportsE1RM: false, muscleLabel: "核心", defaultParams: defParams({ workSets: 4, repMin: 15, repMax: 20, restSeconds: 60 }) },
  { id: "ohp", name: "杠铃推举", primaryMuscles: ["front_delts"], secondaryMuscles: ["triceps"], equipment: "barbell", category: "compound", defaultIncrement: 2.5, supportsE1RM: true, muscleLabel: "肩 · 前束", defaultParams: defParams({ workSets: 4, repMin: 8, repMax: 12, restSeconds: 120 }) },
  { id: "bench", name: "杠铃卧推", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"], equipment: "barbell", category: "compound", defaultIncrement: 2.5, supportsE1RM: true, muscleLabel: "胸 · 中胸", defaultParams: defParams({ workSets: 4, repMin: 5, repMax: 8, restSeconds: 150 }) },
  { id: "smith_bench", name: "史密斯卧推", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: "barbell", category: "compound", defaultIncrement: 2.5, supportsE1RM: true, muscleLabel: "胸 · 中胸", defaultParams: defParams({ workSets: 4, repMin: 8, repMax: 12, restSeconds: 120 }) },
  { id: "cable_fly", name: "绳索夹胸", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: "cable", category: "isolation", defaultIncrement: 2.5, supportsE1RM: false, muscleLabel: "胸", defaultParams: defParams({ workSets: 3, repMin: 12, repMax: 15, restSeconds: 60 }) },
  { id: "pullup", name: "引体向上", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "bodyweight", category: "compound", defaultIncrement: 0, supportsE1RM: false, muscleLabel: "背 · 二头", defaultParams: defParams({ workSets: 4, repMin: 6, repMax: 10, restSeconds: 120 }) },
  { id: "lat_pulldown", name: "高位下拉", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "cable", category: "compound", defaultIncrement: 5, supportsE1RM: true, muscleLabel: "背 · 阔背", defaultParams: defParams({ workSets: 4, repMin: 8, repMax: 12, restSeconds: 120 }) },
  { id: "barbell_row", name: "杠铃划船", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "barbell", category: "compound", defaultIncrement: 2.5, supportsE1RM: true, muscleLabel: "背 · 中背", defaultParams: defParams({ workSets: 4, repMin: 8, repMax: 12, restSeconds: 120 }) },
  { id: "seated_row", name: "坐姿划船", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "machine", category: "compound", defaultIncrement: 5, supportsE1RM: true, muscleLabel: "背", defaultParams: defParams({ workSets: 3, repMin: 10, repMax: 15, restSeconds: 90 }) },
  { id: "face_pull", name: "面拉", primaryMuscles: ["rear_delts"], secondaryMuscles: ["back"], equipment: "cable", category: "isolation", defaultIncrement: 2.5, supportsE1RM: false, muscleLabel: "肩 · 后束", defaultParams: defParams({ workSets: 3, repMin: 15, repMax: 20, restSeconds: 60 }) },
  { id: "squat", name: "杠铃深蹲", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "core"], equipment: "barbell", category: "compound", defaultIncrement: 2.5, supportsE1RM: true, muscleLabel: "腿 · 核心", defaultParams: defParams({ workSets: 5, repMin: 5, repMax: 8, restSeconds: 180 }) },
  { id: "rdl", name: "罗马尼亚硬拉", primaryMuscles: ["hamstrings"], secondaryMuscles: ["glutes", "back"], equipment: "barbell", category: "compound", defaultIncrement: 5, supportsE1RM: true, muscleLabel: "腘绳 · 臀 · 背", defaultParams: defParams({ workSets: 3, repMin: 5, repMax: 8, restSeconds: 150 }) },
  { id: "curl", name: "杠铃弯举", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: "barbell", category: "isolation", defaultIncrement: 2.5, supportsE1RM: false, muscleLabel: "二头", defaultParams: defParams({ workSets: 3, repMin: 10, repMax: 15, restSeconds: 60 }) },
  { id: "db_curl", name: "哑铃弯举", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: "dumbbell", category: "isolation", defaultIncrement: 1, supportsE1RM: false, muscleLabel: "二头", defaultParams: defParams({ workSets: 3, repMin: 10, repMax: 12, restSeconds: 60 }) },
  { id: "skullcrusher", name: "仰卧臂屈伸", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: "barbell", category: "isolation", defaultIncrement: 2.5, supportsE1RM: false, muscleLabel: "三头", defaultParams: defParams({ workSets: 3, repMin: 10, repMax: 12, restSeconds: 60 }) },
  { id: "plank", name: "平板支撑", primaryMuscles: ["core"], secondaryMuscles: [], equipment: "bodyweight", category: "isolation", defaultIncrement: 0, supportsE1RM: false, muscleLabel: "核心", defaultParams: defParams({ workSets: 3, repMin: 30, repMax: 60, restSeconds: 60 }) },
];

LiftOS.isBodyweight = function (exerciseId) {
  const m = LiftOS.getExercise(exerciseId);
  return m?.equipment === "bodyweight";
};

LiftOS.MuscleLabels = {
  chest: "胸", back: "背", shoulders: "肩", side_delts: "肩", front_delts: "前束",
  rear_delts: "后束", biceps: "二头", triceps: "三头", quads: "股四",
  hamstrings: "腘绳肌", glutes: "臀", calves: "小腿", core: "核心",
};

LiftOS.EquipLabels = {
  barbell: "杠铃", dumbbell: "哑铃", machine: "固定器械", cable: "绳索", bodyweight: "自重",
};

LiftOS.getExercise = function (id) {
  return LiftOS.Exercises.find((e) => e.id === id) || null;
};

/** Relative seed so 7d/30d dashboards are populated regardless of wall-clock year. */
LiftOS.SeedHistory = [
  {
    id: "h-incline-3",
    date: LiftOS.daysAgo(3),
    planName: "PUSH A",
    exercises: [
      {
        exerciseId: "incline",
        name: "上斜哑铃卧推",
        sets: [
          { type: "work", weight: 22, reps: 10, rir: 2 },
          { type: "work", weight: 22, reps: 9, rir: 1 },
          { type: "work", weight: 22, reps: 8, rir: 1 },
        ],
      },
      {
        exerciseId: "chest_press",
        name: "坐姿推胸",
        sets: [
          { type: "work", weight: 50, reps: 10, rir: 2 },
          { type: "work", weight: 50, reps: 9, rir: 1 },
          { type: "work", weight: 50, reps: 8, rir: 1 },
        ],
      },
      {
        exerciseId: "lateral",
        name: "哑铃侧平举",
        sets: [
          { type: "work", weight: 10, reps: 15, rir: 1 },
          { type: "work", weight: 10, reps: 14, rir: 1 },
          { type: "work", weight: 10, reps: 12, rir: 0 },
        ],
      },
      {
        exerciseId: "pushdown",
        name: "绳索下压",
        sets: [
          { type: "work", weight: 35, reps: 14, rir: 2 },
          { type: "work", weight: 35, reps: 13, rir: 1 },
          { type: "work", weight: 35, reps: 12, rir: 1 },
        ],
      },
    ],
  },
  {
    id: "h-incline-7",
    date: LiftOS.daysAgo(7),
    planName: "PUSH A",
    exercises: [
      {
        exerciseId: "incline",
        name: "上斜哑铃卧推",
        sets: [
          { type: "work", weight: 20, reps: 12, rir: 1 },
          { type: "work", weight: 20, reps: 11, rir: 1 },
          { type: "work", weight: 20, reps: 10, rir: 2 },
        ],
      },
    ],
  },
  {
    id: "h-incline-12",
    date: LiftOS.daysAgo(12),
    planName: "PUSH A",
    exercises: [
      {
        exerciseId: "incline",
        name: "上斜哑铃卧推",
        sets: [
          { type: "work", weight: 20, reps: 10, rir: 2 },
          { type: "work", weight: 20, reps: 9, rir: 1 },
          { type: "work", weight: 20, reps: 8, rir: 1 },
        ],
      },
    ],
  },
  {
    id: "h-hack-5",
    date: LiftOS.daysAgo(5),
    planName: "LEGS",
    exercises: [
      {
        exerciseId: "hack_squat",
        name: "哈克深蹲",
        sets: [
          { type: "work", weight: 105, reps: 12, rir: 1 },
          { type: "work", weight: 105, reps: 12, rir: 1 },
          { type: "work", weight: 105, reps: 11, rir: 0 },
          { type: "work", weight: 105, reps: 10, rir: 0 },
        ],
      },
      {
        exerciseId: "leg_press",
        name: "腿举",
        sets: [
          { type: "work", weight: 180, reps: 12, rir: 2 },
          { type: "work", weight: 180, reps: 12, rir: 1 },
          { type: "work", weight: 180, reps: 10, rir: 1 },
          { type: "work", weight: 180, reps: 10, rir: 0 },
        ],
      },
      {
        exerciseId: "crunch",
        name: "卷腹",
        sets: [
          { type: "work", weight: 0, reps: 18, rir: 1 },
          { type: "work", weight: 0, reps: 16, rir: 1 },
          { type: "work", weight: 0, reps: 15, rir: 0 },
        ],
      },
    ],
  },
  {
    id: "h-hack-14",
    date: LiftOS.daysAgo(14),
    planName: "LEGS",
    exercises: [
      {
        exerciseId: "hack_squat",
        name: "哈克深蹲",
        sets: [
          { type: "work", weight: 100, reps: 12, rir: 1 },
          { type: "work", weight: 100, reps: 12, rir: 1 },
          { type: "work", weight: 100, reps: 10, rir: 0 },
        ],
      },
    ],
  },
  {
    id: "h-hack-21",
    date: LiftOS.daysAgo(21),
    planName: "LEGS",
    exercises: [
      {
        exerciseId: "hack_squat",
        name: "哈克深蹲",
        sets: [
          { type: "work", weight: 95, reps: 12, rir: 1 },
          { type: "work", weight: 95, reps: 11, rir: 1 },
          { type: "work", weight: 95, reps: 10, rir: 0 },
        ],
      },
    ],
  },
  {
    id: "h-bench-9",
    date: LiftOS.daysAgo(9),
    planName: "PUSH B",
    exercises: [
      {
        exerciseId: "bench",
        name: "杠铃卧推",
        sets: [
          { type: "work", weight: 80, reps: 6, rir: 1 },
          { type: "work", weight: 80, reps: 5, rir: 0 },
        ],
      },
    ],
  },
  {
    id: "h-bench-16",
    date: LiftOS.daysAgo(16),
    planName: "PUSH B",
    exercises: [
      {
        exerciseId: "bench",
        name: "杠铃卧推",
        sets: [
          { type: "work", weight: 75, reps: 8, rir: 1 },
          { type: "work", weight: 75, reps: 7, rir: 1 },
        ],
      },
    ],
  },
  {
    id: "h-old-volume",
    date: LiftOS.daysAgo(28),
    planName: "PUSH A",
    exercises: [
      {
        exerciseId: "incline",
        name: "上斜哑铃卧推",
        sets: [{ type: "work", weight: 18, reps: 12, rir: 1 }],
      },
      {
        exerciseId: "pec_deck",
        name: "蝴蝶机夹胸",
        sets: [{ type: "work", weight: 40, reps: 12, rir: 1 }],
      },
      {
        exerciseId: "pushdown",
        name: "绳索下压",
        sets: [{ type: "work", weight: 30, reps: 15, rir: 1 }],
      },
    ],
  },
  {
    id: "h-legs-35",
    date: LiftOS.daysAgo(35),
    planName: "LEGS",
    exercises: [
      {
        exerciseId: "hack_squat",
        name: "哈克深蹲",
        sets: [
          { type: "work", weight: 80, reps: 10, rir: 2 },
          { type: "work", weight: 80, reps: 10, rir: 1 },
        ],
      },
    ],
  },
  {
    id: "h-legs-42",
    date: LiftOS.daysAgo(42),
    planName: "LEGS",
    exercises: [
      {
        exerciseId: "hack_squat",
        name: "哈克深蹲",
        sets: [
          { type: "work", weight: 70, reps: 12, rir: 1 },
          { type: "work", weight: 70, reps: 10, rir: 0 },
        ],
      },
    ],
  },
  {
    id: "h-squat-2",
    date: LiftOS.daysAgo(2),
    planName: "LEGS",
    exercises: [
      {
        exerciseId: "squat",
        name: "杠铃深蹲",
        sets: [
          { type: "work", weight: 100, reps: 5, rir: 1 },
          { type: "work", weight: 100, reps: 5, rir: 1 },
        ],
      },
      {
        exerciseId: "pullup",
        name: "引体向上",
        sets: [
          { type: "work", weight: 0, reps: 8, rir: 1 },
          { type: "work", weight: 0, reps: 7, rir: 0 },
        ],
      },
    ],
  },
  {
    id: "h-squat-24",
    date: LiftOS.daysAgo(24),
    planName: "LEGS",
    exercises: [
      {
        exerciseId: "squat",
        name: "杠铃深蹲",
        sets: [
          { type: "work", weight: 92.5, reps: 5, rir: 1 },
          { type: "work", weight: 92.5, reps: 5, rir: 0 },
        ],
      },
    ],
  },
];

LiftOS.defaultPlans = function () {
  const now = Date.now();
  return [
    {
      id: "pushA",
      name: "PUSH A",
      muscleLabel: "胸 / 肩 / 三头",
      createdAt: now,
      updatedAt: now,
      exercises: [
        { exerciseId: "incline", order: 0, workSets: 4, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "chest_press", order: 1, workSets: 4, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "pec_deck", order: 2, workSets: 3, repMin: 10, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90, progressionRuleId: "double" },
        { exerciseId: "lateral", order: 3, workSets: 4, repMin: 12, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
        { exerciseId: "pushdown", order: 4, workSets: 4, repMin: 10, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
      ],
    },
    {
      id: "pullA",
      name: "PULL A",
      muscleLabel: "背 / 二头",
      createdAt: now,
      updatedAt: now,
      exercises: [
        { exerciseId: "pullup", order: 0, workSets: 4, repMin: 6, repMax: 10, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "lat_pulldown", order: 1, workSets: 4, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "barbell_row", order: 2, workSets: 4, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "seated_row", order: 3, workSets: 3, repMin: 10, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90, progressionRuleId: "double" },
        { exerciseId: "curl", order: 4, workSets: 3, repMin: 10, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
      ],
    },
    {
      id: "legs",
      name: "LEGS",
      muscleLabel: "腿 / 核心",
      createdAt: now,
      updatedAt: now,
      exercises: [
        { exerciseId: "hack_squat", order: 0, workSets: 5, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 150, progressionRuleId: "double" },
        { exerciseId: "leg_press", order: 1, workSets: 4, repMin: 10, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "leg_ext", order: 2, workSets: 4, repMin: 10, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90, progressionRuleId: "double" },
        { exerciseId: "leg_curl", order: 3, workSets: 4, repMin: 10, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 90, progressionRuleId: "double" },
        { exerciseId: "calf", order: 4, workSets: 4, repMin: 12, repMax: 20, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
        { exerciseId: "crunch", order: 5, workSets: 4, repMin: 15, repMax: 20, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
      ],
    },
    {
      id: "pushB",
      name: "PUSH B",
      muscleLabel: "胸 / 肩 / 三头",
      createdAt: now,
      updatedAt: now,
      exercises: [
        { exerciseId: "bench", order: 0, workSets: 4, repMin: 5, repMax: 8, targetRirMin: 1, targetRirMax: 2, restSeconds: 150, progressionRuleId: "double" },
        { exerciseId: "ohp", order: 1, workSets: 4, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "incline", order: 2, workSets: 3, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "lateral", order: 3, workSets: 3, repMin: 12, repMax: 15, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
        { exerciseId: "skullcrusher", order: 4, workSets: 3, repMin: 10, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
      ],
    },
    {
      id: "pullB",
      name: "PULL B",
      muscleLabel: "背 / 二头",
      createdAt: now,
      updatedAt: now,
      exercises: [
        { exerciseId: "rdl", order: 0, workSets: 3, repMin: 5, repMax: 8, targetRirMin: 1, targetRirMax: 2, restSeconds: 150, progressionRuleId: "double" },
        { exerciseId: "seated_row", order: 1, workSets: 4, repMin: 8, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" },
        { exerciseId: "barbell_row", order: 2, workSets: 3, repMin: 10, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 90, progressionRuleId: "double" },
        { exerciseId: "face_pull", order: 3, workSets: 3, repMin: 15, repMax: 20, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
        { exerciseId: "db_curl", order: 4, workSets: 3, repMin: 10, repMax: 12, targetRirMin: 1, targetRirMax: 2, restSeconds: 60, progressionRuleId: "double" },
      ],
    },
  ];
};
