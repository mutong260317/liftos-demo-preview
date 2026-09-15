/* LiftOS / 训练OS — App Logic */

const MOCK = {
  user: {
    name: "牧童",
    goal: "综合力量 + 减脂",
    weight: 90,
    weeklyTarget: 5,
    restDefault: 90,
  },

  plans: {
    pushA: {
      id: "pushA",
      name: "PUSH A",
      muscleLabel: "胸 / 肩 / 三头",
      exercises: [
        { id: "incline", name: "上斜哑铃卧推", muscle: "胸 · 上胸", sets: 4, reps: "8-12", rir: "1-2", rest: 120 },
        { id: "chest_press", name: "坐姿推胸", muscle: "胸 · 中胸", sets: 4, reps: "8-12", rir: "1-2", rest: 120 },
        { id: "pec_deck", name: "蝴蝶机夹胸", muscle: "胸 · 中缝", sets: 3, reps: "10-15", rir: "1-2", rest: 90 },
        { id: "lateral", name: "哑铃侧平举", muscle: "肩 · 中束", sets: 4, reps: "12-15", rir: "1-2", rest: 60 },
        { id: "pushdown", name: "绳索下压", muscle: "三头", sets: 4, reps: "10-15", rir: "1-2", rest: 60 },
      ],
    },
    legs: {
      id: "legs",
      name: "LEGS",
      muscleLabel: "腿 / 核心",
      exercises: [
        { id: "hack_squat", name: "哈克深蹲", muscle: "腿 · 股四", sets: 5, reps: "8-12", rir: "1-2", rest: 150 },
        { id: "leg_press", name: "腿举", muscle: "腿 · 股四臀", sets: 4, reps: "10-15", rir: "1-2", rest: 120 },
        { id: "leg_ext", name: "腿屈伸", muscle: "腿 · 股四", sets: 4, reps: "10-15", rir: "1-2", rest: 90 },
        { id: "leg_curl", name: "腿弯举", muscle: "腿 · 腘绳肌", sets: 4, reps: "10-15", rir: "1-2", rest: 90 },
        { id: "calf", name: "提踵", muscle: "腿 · 小腿", sets: 4, reps: "12-20", rir: "1-2", rest: 60 },
        { id: "crunch", name: "卷腹", muscle: "核心", sets: 4, reps: "15-20", rir: "1-2", rest: 60 },
      ],
    },
  },

  // Per-exercise last performance + progression advice
  exerciseMeta: {
    incline: {
      lastBest: "22kg × 10",
      lastSets: [10, 9, 8],
      lastWeight: 20,
      suggestedWeight: 22,
      advice: "upgrade",
      adviceTitle: "上次已完成目标次数",
      adviceBody: "今日建议：22kg × 8-12",
      why:
        "你最近一次训练：\n20kg × 12\n20kg × 11\n20kg × 10\n\n已经达到当前目标区间上限。\n因此建议提高重量至 22kg。",
      history: [
        { date: "9月14日", sets: ["22kg × 10", "22kg × 9", "22kg × 8"] },
        { date: "9月10日", sets: ["20kg × 12", "20kg × 11", "20kg × 10"] },
        { date: "9月05日", sets: ["20kg × 10", "20kg × 9", "20kg × 8"] },
        { date: "9月01日", sets: ["18kg × 12", "18kg × 11", "18kg × 10"] },
      ],
      pr: { weight: 22, reps: 10 },
      e1rm: 30.4,
      sessions: 18,
      first: "16kg",
      chart: [16, 18, 20, 22, 22, 24],
    },
    chest_press: {
      lastBest: "50kg × 10",
      lastWeight: 50,
      suggestedWeight: 50,
      advice: "hold",
      adviceTitle: "建议保持重量",
      adviceBody: "今日建议：50kg × 8-12",
      why: "上次表现接近目标区间中段，建议保持当前重量继续累积容量。",
      history: [{ date: "9月14日", sets: ["50kg × 10", "50kg × 9", "50kg × 8"] }],
      pr: { weight: 50, reps: 10 },
      e1rm: 66.7,
      sessions: 12,
      first: "40kg",
      chart: [40, 45, 50, 50, 50, 50],
    },
    pec_deck: {
      lastBest: "45kg × 12",
      lastWeight: 45,
      suggestedWeight: 45,
      advice: "hold",
      adviceTitle: "保持",
      adviceBody: "今日建议：45kg × 10-15",
      why: "上次次数在目标区间内。",
      history: [{ date: "9月14日", sets: ["45kg × 12", "45kg × 11", "45kg × 10"] }],
      pr: { weight: 45, reps: 12 },
      e1rm: 64.3,
      sessions: 10,
      first: "35kg",
      chart: [35, 40, 45, 45, 45, 45],
    },
    lateral: {
      lastBest: "10kg × 15",
      lastWeight: 10,
      suggestedWeight: 10,
      advice: "hold",
      adviceTitle: "保持",
      adviceBody: "今日建议：10kg × 12-15",
      why: "小肌群建议小步渐进，保持重量并提高控制。",
      history: [{ date: "9月14日", sets: ["10kg × 15", "10kg × 14", "10kg × 12"] }],
      pr: { weight: 10, reps: 15 },
      e1rm: 15,
      sessions: 14,
      first: "6kg",
      chart: [6, 8, 10, 10, 10, 10],
    },
    pushdown: {
      lastBest: "35kg × 14",
      lastWeight: 35,
      suggestedWeight: 37.5,
      advice: "upgrade",
      adviceTitle: "可小幅加重",
      adviceBody: "今日建议：37.5kg × 10-15",
      why: "连续两次达到目标次数上限，建议 +2.5kg。",
      history: [
        { date: "9月14日", sets: ["35kg × 14", "35kg × 13", "35kg × 12"] },
        { date: "9月10日", sets: ["35kg × 15", "35kg × 14", "35kg × 13"] },
      ],
      pr: { weight: 35, reps: 15 },
      e1rm: 48.3,
      sessions: 11,
      first: "25kg",
      chart: [25, 30, 35, 35, 35, 37.5],
    },
    hack_squat: {
      lastBest: "110kg × 10",
      lastWeight: 105,
      suggestedWeight: 110,
      advice: "upgrade",
      adviceTitle: "建议升级",
      adviceBody: "今日建议：110kg × 8-12",
      why: "上次 105kg × 12/12/11，已达目标上限。当前 PR 110×10，可冲新纪录。",
      history: [
        { date: "9月12日", sets: ["105kg × 12", "105kg × 12", "105kg × 11", "105kg × 10"] },
        { date: "9月05日", sets: ["100kg × 12", "100kg × 12", "100kg × 10"] },
        { date: "8月29日", sets: ["95kg × 12", "95kg × 11", "95kg × 10"] },
        { date: "8月22日", sets: ["90kg × 10", "90kg × 10", "90kg × 9"] },
        { date: "8月15日", sets: ["80kg × 10", "80kg × 10", "80kg × 9"] },
        { date: "8月08日", sets: ["70kg × 12", "70kg × 10", "70kg × 9"] },
      ],
      pr: { weight: 110, reps: 10 },
      e1rm: 146.7,
      sessions: 24,
      first: "70kg",
      chart: [70, 80, 90, 95, 100, 105, 110],
    },
  },

  library: [
    { id: "incline", name: "上斜哑铃卧推", muscles: "上胸 · 三头 · 前束", muscle: "chest", equip: "dumbbell", equipLabel: "哑铃" },
    { id: "bench", name: "杠铃卧推", muscles: "胸 · 三头 · 前束", muscle: "chest", equip: "barbell", equipLabel: "杠铃" },
    { id: "chest_press", name: "坐姿推胸", muscles: "胸 · 三头", muscle: "chest", equip: "machine", equipLabel: "固定器械" },
    { id: "pec_deck", name: "蝴蝶机夹胸", muscles: "胸 · 中缝", muscle: "chest", equip: "machine", equipLabel: "固定器械" },
    { id: "cable_fly", name: "绳索夹胸", muscles: "胸", muscle: "chest", equip: "cable", equipLabel: "绳索" },
    { id: "smith_bench", name: "史密斯卧推", muscles: "胸 · 三头", muscle: "chest", equip: "barbell", equipLabel: "杠铃" },
    { id: "lateral", name: "哑铃侧平举", muscles: "肩 · 中束", muscle: "shoulder", equip: "dumbbell", equipLabel: "哑铃" },
    { id: "ohp", name: "杠铃推举", muscles: "肩 · 前束", muscle: "shoulder", equip: "barbell", equipLabel: "杠铃" },
    { id: "face_pull", name: "面拉", muscles: "肩 · 后束", muscle: "shoulder", equip: "cable", equipLabel: "绳索" },
    { id: "pullup", name: "引体向上", muscles: "背 · 二头", muscle: "back", equip: "bodyweight", equipLabel: "自重" },
    { id: "lat_pulldown", name: "高位下拉", muscles: "背 · 阔背", muscle: "back", equip: "cable", equipLabel: "绳索" },
    { id: "barbell_row", name: "杠铃划船", muscles: "背 · 中背", muscle: "back", equip: "barbell", equipLabel: "杠铃" },
    { id: "seated_row", name: "坐姿划船", muscles: "背", muscle: "back", equip: "machine", equipLabel: "固定器械" },
    { id: "hack_squat", name: "哈克深蹲", muscles: "股四 · 臀", muscle: "leg", equip: "machine", equipLabel: "固定器械" },
    { id: "squat", name: "杠铃深蹲", muscles: "腿 · 核心", muscle: "leg", equip: "barbell", equipLabel: "杠铃" },
    { id: "leg_press", name: "腿举", muscles: "股四 · 臀", muscle: "leg", equip: "machine", equipLabel: "固定器械" },
    { id: "leg_ext", name: "腿屈伸", muscles: "股四", muscle: "leg", equip: "machine", equipLabel: "固定器械" },
    { id: "leg_curl", name: "腿弯举", muscles: "腘绳肌", muscle: "leg", equip: "machine", equipLabel: "固定器械" },
    { id: "rdl", name: "罗马尼亚硬拉", muscles: "腘绳 · 臀 · 背", muscle: "leg", equip: "barbell", equipLabel: "杠铃" },
    { id: "calf", name: "站姿提踵", muscles: "小腿", muscle: "leg", equip: "machine", equipLabel: "固定器械" },
    { id: "curl", name: "杠铃弯举", muscles: "二头", muscle: "biceps", equip: "barbell", equipLabel: "杠铃" },
    { id: "db_curl", name: "哑铃弯举", muscles: "二头", muscle: "biceps", equip: "dumbbell", equipLabel: "哑铃" },
    { id: "pushdown", name: "绳索下压", muscles: "三头", muscle: "triceps", equip: "cable", equipLabel: "绳索" },
    { id: "skullcrusher", name: "仰卧臂屈伸", muscles: "三头", muscle: "triceps", equip: "barbell", equipLabel: "杠铃" },
    { id: "crunch", name: "卷腹", muscles: "腹直肌", muscle: "core", equip: "bodyweight", equipLabel: "自重" },
    { id: "plank", name: "平板支撑", muscles: "核心", muscle: "core", equip: "bodyweight", equipLabel: "自重" },
  ],

  replacements: {
    incline: [
      { id: "chest_press", name: "坐姿推胸", muscle: "胸 · 中胸" },
      { id: "smith_bench", name: "史密斯卧推", muscle: "胸 · 中胸" },
      { id: "bench", name: "平板哑铃卧推", muscle: "胸 · 中胸" },
      { id: "pec_deck", name: "蝴蝶机夹胸", muscle: "胸 · 中缝" },
    ],
    default: [
      { id: "alt1", name: "器械推胸", muscle: "胸" },
      { id: "alt2", name: "史密斯卧推", muscle: "胸" },
      { id: "alt3", name: "平板哑铃卧推", muscle: "胸" },
      { id: "alt4", name: "蝴蝶机夹胸", muscle: "胸" },
    ],
  },
};

const app = {
  theme: "dark",
  screen: "home",
  inWorkout: false,
  workoutStart: null,
  workoutTimerInterval: null,
  restInterval: null,
  restRemaining: 0,
  restDuration: 90,
  toastTimer: null,
  session: null,
  libMuscleFilter: "all",
  libEquipFilter: "all",
  libraryTarget: "browse", // or 'plan'

  /* ---------- boot ---------- */
  init() {
    const saved = localStorage.getItem("liftos-theme");
    if (saved) this.setTheme(saved);
    this.tickStatusClock();
    setInterval(() => this.tickStatusClock(), 30000);
    document.querySelectorAll(".range-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".range-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    document.querySelectorAll("#goalSeg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#goalSeg button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    this.bindLibFilters();
    this.renderLibrary();
  },

  tickStatusClock() {
    const el = document.getElementById("statusTime");
    const now = new Date();
    el.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  },

  setTheme(mode) {
    this.theme = mode;
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("liftos-theme", mode);
    const label = document.getElementById("themeLabel");
    if (label) label.textContent = mode === "dark" ? "深色" : "浅色";
    document.querySelectorAll("[data-theme-btn]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-theme-btn") === mode);
    });
  },

  /* ---------- navigation ---------- */
  nav(name) {
    if (name === "training") return this.navTraining();
    this.screen = name;
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.toggle("active", s.dataset.screen === name);
    });
    document.querySelectorAll(".nav-item").forEach((n) => {
      n.classList.toggle("active", n.dataset.nav === name);
    });
    // show nav on main tabs
    document.getElementById("bottomNav").classList.remove("hidden");
    // close subpages
    document.querySelectorAll(".subpage").forEach((p) => p.classList.remove("active"));
    window.scrollTo?.(0, 0);
    const sc = document.querySelector(`.screen[data-screen="${name}"]`);
    if (sc) sc.scrollTop = 0;
  },

  navTraining() {
    if (!this.inWorkout) {
      // Start from home card path, or resume
      this.startWorkout();
      return;
    }
    this.screen = "training";
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.toggle("active", s.dataset.screen === "training");
    });
    document.querySelectorAll(".nav-item").forEach((n) => {
      n.classList.toggle("active", n.dataset.nav === "training");
    });
    document.getElementById("bottomNav").classList.add("hidden");
  },

  openSubpage(id) {
    document.getElementById(id).classList.add("active");
  },

  closeSubpage(id) {
    document.getElementById(id).classList.remove("active");
  },

  /* ---------- workout session ---------- */
  startWorkout() {
    if (this.inWorkout) {
      this.navTraining();
      return;
    }
    const plan = MOCK.plans.pushA;
    this.session = {
      planId: plan.id,
      planName: plan.name,
      startTime: Date.now(),
      exIndex: 0,
      exercises: plan.exercises.map((ex) => {
        const meta = MOCK.exerciseMeta[ex.id] || {};
        const weight = meta.suggestedWeight ?? meta.lastWeight ?? 20;
        const sets = [];
        for (let i = 0; i < ex.sets; i++) {
          sets.push({
            type: i === 0 && ex.sets > 3 ? "warmup" : "work",
            num: i + 1,
            weight,
            reps: null,
            rir: null,
            done: false,
            isPR: false,
          });
        }
        // first set of first exercise can be warmup-looking optional
        if (ex.id === "incline") {
          sets.unshift({
            type: "warmup",
            num: 0,
            weight: Math.max(10, weight - 8),
            reps: 12,
            rir: null,
            done: false,
            isPR: false,
            warmup: true,
          });
        }
        return {
          id: ex.id,
          name: ex.name,
          muscle: ex.muscle,
          targetReps: ex.reps,
          targetRir: ex.rir,
          rest: ex.rest,
          sets,
          skipped: false,
          notes: ex.id === "incline" ? "座椅调到 4\n靠背 30°\n肩胛下沉\n不要耸肩" : "",
        };
      }),
      prs: [],
      volume: 0,
      completedSets: 0,
    };

    this.inWorkout = true;
    this.workoutStart = Date.now();
    this.startWorkoutTimer();
    this.navTraining();
    this.renderCurrentExercise();
    this.showToast("训练开始 · PUSH A");
    document.getElementById("resumeBanner").classList.add("hide");
  },

  continueWorkout() {
    if (this.session) this.navTraining();
  },

  startWorkoutTimer() {
    clearInterval(this.workoutTimerInterval);
    const tick = () => {
      const sec = Math.floor((Date.now() - this.workoutStart) / 1000);
      const h = String(Math.floor(sec / 3600)).padStart(2, "0");
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      const el = document.getElementById("workoutTimer");
      if (el) el.textContent = `${h}:${m}:${s}`;
    };
    tick();
    this.workoutTimerInterval = setInterval(tick, 1000);
  },

  get currentEx() {
    return this.session?.exercises[this.session.exIndex];
  },

  get activeSetIndex() {
    const ex = this.currentEx;
    if (!ex) return -1;
    return ex.sets.findIndex((s) => !s.done);
  },

  renderCurrentExercise() {
    if (!this.session) return;
    const ex = this.currentEx;
    if (!ex) {
      this.endWorkout();
      return;
    }

    const doneAll = ex.sets.every((s) => s.done || s.warmup);
    // show complete view if all work sets done
    const workDone = ex.sets.filter((s) => !s.warmup).every((s) => s.done);

    document.getElementById("exLoggingView").classList.toggle("hide", workDone);
    document.getElementById("exCompleteView").classList.toggle("hide", !workDone);

    if (workDone) {
      const workSets = ex.sets.filter((s) => !s.warmup && s.done);
      const vol = workSets.reduce((a, s) => a + s.weight * s.reps, 0);
      document.getElementById("doneExName").textContent = ex.name;
      document.getElementById("doneExSets").textContent = `${workSets.length} / ${ex.sets.filter((s) => !s.warmup).length} 组完成`;
      document.getElementById("doneVolume").textContent = `${vol.toLocaleString()} kg`;
      document.getElementById("doneDelta").textContent = vol > 0 ? "↑ 7.2%" : "—";
      const nextBtn = document.getElementById("nextExBtn");
      nextBtn.textContent = this.session.exIndex >= this.session.exercises.length - 1 ? "结束训练" : "下一动作";
    }

    // progress label
    document.getElementById("exProgressLabel").textContent =
      `${Math.min(this.session.exIndex + 1, this.session.exercises.length)} / ${this.session.exercises.length} 动作`;

    // set progress bar
    const totalWork = this.session.exercises.reduce((a, e) => a + e.sets.filter((s) => !s.warmup).length, 0);
    const doneWork = this.session.exercises.reduce(
      (a, e) => a + e.sets.filter((s) => !s.warmup && s.done).length,
      0
    );
    document.getElementById("setProgressFill").style.width = `${(doneWork / totalWork) * 100}%`;

    document.getElementById("exName").textContent = ex.name;
    document.getElementById("exMuscle").textContent = ex.muscle;

    // history strip
    const meta = MOCK.exerciseMeta[ex.id] || {};
    const strip = document.getElementById("historyStrip");
    strip.innerHTML = `
      <div class="chip">上次最佳 <strong>${meta.lastBest || "—"}</strong></div>
      <div class="chip advice">今日建议 <strong>${meta.suggestedWeight || "—"}kg × ${ex.targetReps}</strong></div>
      <div class="chip">目标 <strong>${ex.targetReps}次</strong></div>
      <div class="chip">RIR <strong>${ex.targetRir}</strong></div>
    `;

    // advice
    const adviceCard = document.getElementById("adviceCard");
    if (meta.advice) {
      adviceCard.classList.remove("hide");
      document.getElementById("adviceTag").textContent =
        meta.advice === "upgrade" ? "建议升级" : meta.advice === "stall" ? "训练停滞" : "建议保持";
      document.getElementById("adviceTitle").textContent = meta.adviceTitle || "";
      document.getElementById("adviceBody").textContent = meta.adviceBody || "";
    } else {
      adviceCard.classList.add("hide");
    }

    // notes
    const notes = document.getElementById("notesInput");
    notes.value = ex.notes || "";

    this.renderSetList();
  },

  renderSetList() {
    const ex = this.currentEx;
    if (!ex) return;
    const activeIdx = this.activeSetIndex;
    const meta = MOCK.exerciseMeta[ex.id] || {};
    const list = document.getElementById("setList");

    list.innerHTML = ex.sets
      .map((set, i) => {
        const isActive = i === activeIdx;
        const isDone = set.done;
        const prev =
          set.warmup
            ? "热身"
            : `${meta.lastWeight || "—"}×${(meta.lastSets && meta.lastSets[Math.min(i - 1, (meta.lastSets.length || 1) - 1)]) || "—"}`;

        if (isActive) {
          return `
            <div class="set-card active" data-set="${i}">
              <div class="set-editor">
                <div class="set-label">${set.warmup ? "热身组" : `第 ${set.num} 组`} · 工作组目标 ${ex.targetReps}</div>
                <div class="last-best">上次最佳 ${meta.lastBest || "—"}</div>

                <div class="stepper-block">
                  <div class="label">重量</div>
                  <div class="stepper">
                    <button class="stepper-btn fast" onclick="app.stepWeight(${i}, -2.5)">−2.5</button>
                    <div class="stepper-value" onclick="app.openWeightInput(${i})">
                      <span id="wDisplay">${set.weight}</span><span class="unit">kg</span>
                    </div>
                    <button class="stepper-btn fast" onclick="app.stepWeight(${i}, 2.5)">+2.5</button>
                  </div>
                </div>

                <div class="stepper-block">
                  <div class="label">次数</div>
                  <div class="stepper">
                    <button class="stepper-btn" onclick="app.stepReps(${i}, -1)">−</button>
                    <div class="stepper-value" onclick="app.openRepsInput(${i})">
                      <span id="rDisplay">${set.reps ?? "—"}</span><span class="unit">次</span>
                    </div>
                    <button class="stepper-btn" onclick="app.stepReps(${i}, 1)">+</button>
                  </div>
                </div>

                <div class="stepper-block">
                  <div class="label">RIR（剩余次数）</div>
                  <div class="rir-row">
                    ${[3, 2, 1, 0]
                      .map(
                        (r) =>
                          `<button class="rir-btn ${set.rir === r ? "selected" : ""}" onclick="app.setRir(${i}, ${r})">${r}</button>`
                      )
                      .join("")}
                  </div>
                </div>

                <button class="complete-set-btn" id="completeBtn" onclick="app.completeSet(${i})">
                  ✓ 完成本组
                </button>
              </div>
            </div>
          `;
        }

        return `
          <div class="set-card ${isDone ? "done" : ""}" data-set="${i}">
            <div class="set-row-compact ${isDone ? "done-set" : ""}">
              <div class="set-num">${set.warmup ? "热身" : set.num}</div>
              <div class="prev"><strong>${prev}</strong></div>
              <div class="set-num-display ${isDone ? "" : "placeholder"}" onclick="app.activateSet(${i})">${isDone ? set.weight : set.weight}</div>
              <div class="set-num-display ${isDone ? "" : "placeholder"}" onclick="app.activateSet(${i})">${isDone ? set.reps : "—"}</div>
              <button class="complete-dot ${isDone ? "done" : ""}" onclick="${isDone ? "app.uncompleteSet(" + i + ")" : "app.activateSet(" + i + ")"}">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // Auto-fill reps from previous or target mid if empty for active set
    if (activeIdx >= 0) {
      const set = ex.sets[activeIdx];
      if (set.reps == null) {
        // inherit mid of target or previous completed
        const prevDone = [...ex.sets].slice(0, activeIdx).reverse().find((s) => s.done && !s.warmup);
        if (prevDone) set.reps = prevDone.reps;
        else {
          const m = /(\d+)\s*-\s*(\d+)/.exec(ex.targetReps);
          if (m) set.reps = Math.round((+m[1] + +m[2]) / 2);
          else set.reps = 10;
        }
        // re-render displays without full re-render loop - just update
        const rDisp = document.getElementById("rDisplay");
        if (rDisp) rDisp.textContent = set.reps;
      }
      if (set.rir == null) {
        set.rir = 2;
        // visual update
        document.querySelectorAll(".rir-btn").forEach((b) => {
          const v = +b.textContent;
          b.classList.toggle("selected", v === set.rir);
        });
      }
    }
  },

  activateSet(i) {
    // move focus to this set if previous are done
    const ex = this.currentEx;
    if (!ex || ex.sets[i].done) return;
    // only allow activating the first undone or any if we want - keep simple: first undone
    this.renderSetList();
  },

  stepWeight(setIdx, delta) {
    const ex = this.currentEx;
    if (!ex) return;
    const set = ex.sets[setIdx];
    set.weight = Math.max(0, Math.round((set.weight + delta) * 10) / 10);
    const el = document.getElementById("wDisplay");
    if (el) el.textContent = set.weight;
    // haptic concept
    if (navigator.vibrate) navigator.vibrate(8);
  },

  stepReps(setIdx, delta) {
    const ex = this.currentEx;
    if (!ex) return;
    const set = ex.sets[setIdx];
    if (set.reps == null) set.reps = 0;
    set.reps = Math.max(0, set.reps + delta);
    const el = document.getElementById("rDisplay");
    if (el) el.textContent = set.reps;
    if (navigator.vibrate) navigator.vibrate(8);
  },

  setRir(setIdx, rir) {
    const ex = this.currentEx;
    if (!ex) return;
    ex.sets[setIdx].rir = rir;
    document.querySelectorAll(".rir-btn").forEach((b) => {
      b.classList.toggle("selected", +b.textContent === rir);
    });
  },

  openWeightInput(setIdx) {
    const ex = this.currentEx;
    const set = ex.sets[setIdx];
    this.openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>输入重量</h3>
        <div class="num-input-wrap">
          <input id="modalWeight" type="number" inputmode="decimal" step="2.5" value="${set.weight}" />
          <span class="unit">kg</span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.saveModalWeight(${setIdx})">确认</button>
          <button class="btn btn-ghost" onclick="app.closeOverlay()">取消</button>
        </div>
      </div>
    `);
    setTimeout(() => document.getElementById("modalWeight")?.focus(), 100);
  },

  saveModalWeight(setIdx) {
    const v = parseFloat(document.getElementById("modalWeight").value);
    if (!isNaN(v) && v >= 0) {
      this.currentEx.sets[setIdx].weight = v;
      const el = document.getElementById("wDisplay");
      if (el) el.textContent = v;
    }
    this.closeOverlay();
  },

  openRepsInput(setIdx) {
    const ex = this.currentEx;
    const set = ex.sets[setIdx];
    this.openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>输入次数</h3>
        <div class="num-input-wrap">
          <input id="modalReps" type="number" inputmode="numeric" value="${set.reps ?? 10}" />
          <span class="unit">次</span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.saveModalReps(${setIdx})">确认</button>
          <button class="btn btn-ghost" onclick="app.closeOverlay()">取消</button>
        </div>
      </div>
    `);
    setTimeout(() => document.getElementById("modalReps")?.focus(), 100);
  },

  saveModalReps(setIdx) {
    const v = parseInt(document.getElementById("modalReps").value, 10);
    if (!isNaN(v) && v >= 0) {
      this.currentEx.sets[setIdx].reps = v;
      const el = document.getElementById("rDisplay");
      if (el) el.textContent = v;
    }
    this.closeOverlay();
  },

  completeSet(setIdx) {
    const ex = this.currentEx;
    if (!ex) return;
    const set = ex.sets[setIdx];
    if (set.reps == null || set.reps === 0) {
      this.showToast("请先填写次数");
      return;
    }

    set.done = true;

    // PR detection (simple)
    const meta = MOCK.exerciseMeta[ex.id] || {};
    if (!set.warmup && meta.pr) {
      if (set.weight > meta.pr.weight || (set.weight === meta.pr.weight && set.reps > meta.pr.reps)) {
        set.isPR = true;
        this.session.prs.push({ name: ex.name, weight: set.weight, reps: set.reps });
        meta.pr = { weight: set.weight, reps: set.reps };
        meta.lastBest = `${set.weight}kg × ${set.reps}`;
        this.showToast(`🏆 新纪录 ${set.weight}kg × ${set.reps}`, "pr");
      }
    }

    if (!set.warmup) {
      this.session.volume += set.weight * set.reps;
      this.session.completedSets += 1;
    }

    if (navigator.vibrate) navigator.vibrate(18);

    // start rest
    this.startRest(ex.rest || this.restDuration);

    // if more sets, render; else complete view
    this.renderCurrentExercise();
  },

  uncompleteSet(setIdx) {
    // optional: allow undo - skip for demo simplicity or implement
    this.showToast("已完成的组请谨慎撤销");
  },

  /* ---------- rest timer ---------- */
  startRest(seconds) {
    clearInterval(this.restInterval);
    this.restRemaining = seconds;
    this.restDuration = seconds;
    const bar = document.getElementById("restBar");
    bar.classList.add("visible");
    bar.classList.remove("ending");
    this.updateRestDisplay();

    this.restInterval = setInterval(() => {
      this.restRemaining -= 1;
      if (this.restRemaining <= 10) bar.classList.add("ending");
      if (this.restRemaining <= 0) {
        this.endRest(true);
        return;
      }
      this.updateRestDisplay();
    }, 1000);
  },

  updateRestDisplay() {
    const m = String(Math.floor(this.restRemaining / 60)).padStart(2, "0");
    const s = String(this.restRemaining % 60).padStart(2, "0");
    document.getElementById("restTime").textContent = `${m}:${s}`;
  },

  adjustRest(delta) {
    this.restRemaining = Math.max(0, this.restRemaining + delta);
    document.getElementById("restBar").classList.toggle("ending", this.restRemaining <= 10 && this.restRemaining > 0);
    this.updateRestDisplay();
  },

  skipRest() {
    this.endRest(false);
  },

  endRest(natural) {
    clearInterval(this.restInterval);
    this.restInterval = null;
    const bar = document.getElementById("restBar");
    bar.classList.remove("visible", "ending");
    if (natural) {
      this.showToast("休息结束");
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    }
    // focus next set
    this.renderSetList();
  },

  /* ---------- exercise flow ---------- */
  nextExercise() {
    if (!this.session) return;
    if (this.session.exIndex >= this.session.exercises.length - 1) {
      this.endWorkout();
      return;
    }
    this.session.exIndex += 1;
    this.endRest(false);
    this.renderCurrentExercise();
  },

  skipExercise() {
    if (!this.currentEx) return;
    this.currentEx.skipped = true;
    this.nextExercise();
  },

  addExercise() {
    this.libraryTarget = "workout";
    this.renderLibrary();
    this.openSubpage("subpage-library");
  },

  openReplaceSheet() {
    const ex = this.currentEx;
    const list = MOCK.replacements[ex?.id] || MOCK.replacements.default;
    this.openOverlay(`
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3>替换动作</h3>
          <button class="btn btn-ghost btn-sm" onclick="app.closeOverlay()">关闭</button>
        </div>
        <div class="sheet-body">
          <p class="text-secondary mb-3" style="font-size:13px">推荐替代 · 同肌群</p>
          ${list
            .map(
              (r) => `
            <button class="replace-item" onclick="app.applyReplace('${r.id}','${r.name}','${r.muscle}')">
              <div>
                <div class="name">${r.name}</div>
                <div class="muscle">${r.muscle}</div>
              </div>
              <span class="text-accent">选择</span>
            </button>
          `
            )
            .join("")}
        </div>
      </div>
    `);
  },

  applyReplace(id, name, muscle) {
    const ex = this.currentEx;
    if (!ex) return;
    ex.id = id;
    ex.name = name;
    ex.muscle = muscle;
    const meta = MOCK.exerciseMeta[id];
    if (meta) {
      ex.sets.forEach((s) => {
        if (!s.done) s.weight = meta.suggestedWeight ?? meta.lastWeight ?? s.weight;
      });
    }
    this.closeOverlay();
    this.renderCurrentExercise();
    this.showToast(`已替换为 ${name}`);
  },

  openWorkoutProgress() {
    if (!this.session) return;
    const rows = this.session.exercises
      .map((ex, i) => {
        const work = ex.sets.filter((s) => !s.warmup);
        const done = work.filter((s) => s.done).length;
        let cls = "todo";
        let icon = "○";
        if (ex.skipped) {
          cls = "todo";
          icon = "—";
        } else if (done === work.length && work.length > 0) {
          cls = "done";
          icon = "✓";
        } else if (i === this.session.exIndex) {
          cls = "current";
          icon = "●";
        }
        return `
          <div class="item">
            <div class="status-icon ${cls}">${icon}</div>
            <div class="name">${ex.name}</div>
            <div class="count">${done}/${work.length}</div>
          </div>
        `;
      })
      .join("");

    this.openOverlay(`
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3>训练进度 · ${this.session.planName}</h3>
          <button class="btn btn-ghost btn-sm" onclick="app.closeOverlay()">关闭</button>
        </div>
        <div class="sheet-body">
          <div class="progress-list">${rows}</div>
          <button class="btn btn-secondary btn-block mt-4" onclick="app.addExerciseFromSheet()">+ 添加动作</button>
          <button class="btn btn-danger btn-block mt-2" onclick="app.confirmEndWorkout()">结束训练</button>
        </div>
      </div>
    `);
  },

  addExerciseFromSheet() {
    this.closeOverlay();
    this.addExercise();
  },

  confirmEndWorkout() {
    this.openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>结束训练？</h3>
        <p>当前进度会保存到本次训练总结。确定要结束吗？</p>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="app.endWorkout()">结束并总结</button>
          <button class="btn btn-ghost" onclick="app.closeOverlay()">继续训练</button>
        </div>
      </div>
    `);
  },

  endWorkout() {
    clearInterval(this.workoutTimerInterval);
    clearInterval(this.restInterval);
    document.getElementById("restBar").classList.remove("visible");

    // compute summary
    const elapsed = this.workoutStart ? Date.now() - this.workoutStart : 45 * 60000;
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    document.getElementById("sumTime").textContent = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;

    const exCount = this.session?.exercises.filter((e) => !e.skipped && e.sets.some((s) => s.done && !s.warmup)).length || 0;
    document.getElementById("sumEx").textContent = exCount;
    document.getElementById("sumSets").textContent = this.session?.completedSets || 0;
    document.getElementById("sumVol").textContent = (this.session?.volume || 0).toLocaleString();
    document.getElementById("sumPr").textContent = this.session?.prs.length || 0;

    // avg RIR mock
    document.getElementById("sumRir").textContent = "1.8";

    // PR list
    const prList = document.getElementById("todayPrList");
    if (this.session?.prs.length) {
      document.getElementById("todayPrSection").classList.remove("hide");
      prList.innerHTML = this.session.prs
        .map(
          (p) => `
        <div class="pr-item">
          <div>
            <div class="ex-name">${p.name}</div>
            <div class="ex-detail">${p.weight}kg × ${p.reps}</div>
          </div>
          <span class="badge-pr">New PR</span>
        </div>
      `
        )
        .join("");
    } else {
      prList.innerHTML = `<div class="text-secondary" style="font-size:13px;padding:8px 0">本次未刷新个人纪录，继续保持。</div>`;
    }

    this.closeOverlay();
    this.inWorkout = false;
    this.session = null;

    // show summary screen
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.toggle("active", s.dataset.screen === "summary");
    });
    document.getElementById("bottomNav").classList.add("hidden");
    this.screen = "summary";
  },

  setFeeling(n) {
    document.querySelectorAll(".feeling-btn").forEach((b) => {
      b.classList.toggle("selected", +b.dataset.feel === n);
    });
  },

  finishSummary() {
    this.showToast("训练已保存");
    this.nav("home");
    document.getElementById("bottomNav").classList.remove("hidden");
  },

  toggleNotes(btn) {
    btn.classList.toggle("open");
    document.getElementById("notesBody").classList.toggle("open");
  },

  openWhySheet() {
    const meta = MOCK.exerciseMeta[this.currentEx?.id] || {};
    this.openOverlay(`
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3>为什么这样建议？</h3>
          <button class="btn btn-ghost btn-sm" onclick="app.closeOverlay()">关闭</button>
        </div>
        <div class="sheet-body">
          <div class="card" style="white-space:pre-line;font-size:14px;line-height:1.6;color:var(--text-secondary)">
${meta.why || "根据你最近的训练表现与目标次数区间给出的规则建议。"}
          </div>
          <p class="mt-3 text-secondary" style="font-size:12px;line-height:1.5">
            规则透明：达到目标区间上限 → 建议加重；次数明显不足 → 建议保持或减重；连续无进步 → 提示调整。
          </p>
        </div>
      </div>
    `);
  },

  /* ---------- plans ---------- */
  openPlanDetail(planId) {
    const plan = MOCK.plans[planId] || MOCK.plans.pushA;
    // build fallback plan content
    const content = {
      pushA: MOCK.plans.pushA,
      legs: MOCK.plans.legs,
      pullA: {
        name: "PULL A",
        muscleLabel: "背 / 二头",
        exercises: [
          { name: "引体向上", sets: 4, reps: "6-10" },
          { name: "高位下拉", sets: 4, reps: "8-12" },
          { name: "杠铃划船", sets: 4, reps: "8-12" },
          { name: "坐姿划船", sets: 3, reps: "10-15" },
          { name: "杠铃弯举", sets: 3, reps: "10-15" },
        ],
      },
      pushB: {
        name: "PUSH B",
        muscleLabel: "胸 / 肩 / 三头",
        exercises: [
          { name: "杠铃卧推", sets: 4, reps: "5-8" },
          { name: "哑铃肩推", sets: 4, reps: "8-12" },
          { name: "上斜哑铃卧推", sets: 3, reps: "8-12" },
          { name: "绳索侧平举", sets: 3, reps: "12-15" },
          { name: "仰卧臂屈伸", sets: 3, reps: "10-12" },
        ],
      },
      pullB: {
        name: "PULL B",
        muscleLabel: "背 / 二头",
        exercises: [
          { name: "杠铃硬拉", sets: 3, reps: "5-6" },
          { name: "坐姿划船", sets: 4, reps: "8-12" },
          { name: "单臂哑铃划船", sets: 3, reps: "10-12" },
          { name: "面拉", sets: 3, reps: "15-20" },
          { name: "锤式弯举", sets: 3, reps: "10-12" },
        ],
      },
    };
    const p = content[planId] || plan;
    document.getElementById("planDetailTitle").textContent = p.name;
    document.getElementById("planDetailBody").innerHTML = `
      <p class="text-secondary mb-3" style="font-size:14px">${p.muscleLabel}</p>
      <div class="card">
        ${p.exercises
          .map(
            (ex, i) => `
          <div class="plan-day-item">
            <div class="idx">${i + 1}</div>
            <div class="info">
              <div class="name">${ex.name}</div>
              <div class="sets">${ex.sets} × ${ex.reps}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      <button class="btn btn-primary btn-block btn-lg mt-4" onclick="app.closeSubpage('subpage-plan'); app.startWorkoutFromPlan('${planId}')">
        用此计划开始
      </button>
    `;
    this.openSubpage("subpage-plan");
  },

  startWorkoutFromPlan(planId) {
    if (planId === "legs") {
      this.showToast("Demo 主流程使用 PUSH A，已切回");
    }
    this.startWorkout();
  },

  openCreatePlan() {
    this.openSubpage("subpage-create-plan");
  },

  savePlan() {
    this.closeSubpage("subpage-create-plan");
    this.showToast("计划已保存");
  },

  openLibraryForPlan() {
    this.libraryTarget = "plan";
    this.renderLibrary();
    this.openSubpage("subpage-library");
  },

  /* ---------- library ---------- */
  bindLibFilters() {
    document.querySelectorAll("#libFilters .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("#libFilters .filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        this.libMuscleFilter = chip.dataset.muscle;
        this.renderLibrary();
      });
    });
    document.querySelectorAll("#libEquipFilters .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("#libEquipFilters .filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        this.libEquipFilter = chip.dataset.equip;
        this.renderLibrary();
      });
    });
  },

  filterLibrary() {
    this.renderLibrary();
  },

  renderLibrary() {
    const q = (document.getElementById("libSearch")?.value || "").trim().toLowerCase();
    const list = MOCK.library.filter((ex) => {
      if (this.libMuscleFilter !== "all" && ex.muscle !== this.libMuscleFilter) return false;
      if (this.libEquipFilter !== "all" && ex.equip !== this.libEquipFilter) return false;
      if (q && !ex.name.toLowerCase().includes(q) && !ex.muscles.includes(q)) return false;
      return true;
    });

    const el = document.getElementById("libraryList");
    if (!list.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔍</div>
          <h3>没有匹配动作</h3>
          <p>试试更换肌群或器械筛选</p>
        </div>
      `;
      return;
    }

    el.innerHTML = list
      .map(
        (ex) => `
      <div class="ex-card" onclick="app.openExerciseDetail('${ex.id}')">
        <h3>${ex.name}</h3>
        <div class="muscles">${ex.muscles}</div>
        <span class="equip">${ex.equipLabel}</span>
      </div>
    `
      )
      .join("");
  },

  openExerciseDetail(id) {
    const ex = MOCK.library.find((e) => e.id === id);
    const meta = MOCK.exerciseMeta[id];
    if (!ex) return;

    document.getElementById("exDetailTitle").textContent = ex.name;

    if (meta) {
      const chart = meta.chart || [];
      const max = Math.max(...chart, 1);
      const min = Math.min(...chart);
      const points = chart
        .map((v, i) => {
          const x = (i / (chart.length - 1)) * 300 + 20;
          const y = 130 - ((v - min) / Math.max(max - min, 1)) * 100;
          return `${x},${y}`;
        })
        .join(" ");

      document.getElementById("exDetailBody").innerHTML = `
        <div class="content">
          <div class="metric-row mb-4">
            <div class="metric-card">
              <div class="label">当前最佳</div>
              <div class="value" style="font-size:20px">${meta.lastBest}</div>
            </div>
            <div class="metric-card">
              <div class="label">预计 1RM</div>
              <div class="value" style="font-size:20px">${meta.e1rm} kg</div>
            </div>
            <div class="metric-card">
              <div class="label">训练次数</div>
              <div class="value" style="font-size:20px">${meta.sessions}</div>
            </div>
            <div class="metric-card">
              <div class="label">首次重量</div>
              <div class="value" style="font-size:20px">${meta.first}</div>
            </div>
          </div>

          <div class="chart-box">
            <div class="chart-title">力量趋势</div>
            <div class="chart-sub">重量 / e1RM 走势</div>
            <svg class="chart-svg" viewBox="0 0 340 160">
              <line class="grid-line" x1="20" y1="30" x2="320" y2="30"/>
              <line class="grid-line" x1="20" y1="80" x2="320" y2="80"/>
              <line class="grid-line" x1="20" y1="130" x2="320" y2="130"/>
              <polyline class="line" points="${points}" fill="none"/>
            </svg>
          </div>

          <div class="section">
            <div class="section-title">主要肌群</div>
            <p class="text-secondary" style="font-size:14px">${ex.muscles}</p>
          </div>

          <div class="section">
            <div class="section-title">训练历史</div>
            <div class="card">
              ${meta.history
                .map(
                  (h) => `
                <div class="history-session">
                  <div class="date">${h.date}</div>
                  ${h.sets.map((s) => `<div class="set-line">${s}</div>`).join("")}
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          ${
            id === "hack_squat"
              ? `
          <div class="section">
            <div class="section-title">渐进建议</div>
            <div class="advice-card" style="margin:0">
              <div class="tag">建议升级</div>
              <h4>上次已完成目标次数</h4>
              <p>105kg 连续多组达 12 次上限。今日建议 110kg × 8-12。</p>
              <button class="why" onclick="app.showToast('透明规则：达上限则加重')">为什么？</button>
            </div>
          </div>`
              : ""
          }
        </div>
      `;
    } else {
      document.getElementById("exDetailBody").innerHTML = `
        <div class="content">
          <div class="card mb-3">
            <h3 style="font-size:17px;font-weight:700">${ex.name}</h3>
            <p class="text-secondary mt-2" style="font-size:14px">主要肌群：${ex.muscles}</p>
            <p class="text-secondary mt-1" style="font-size:14px">器械：${ex.equipLabel}</p>
          </div>
          <div class="empty-state">
            <div class="icon">📊</div>
            <h3>还没有这个动作的训练数据</h3>
            <p>完成第一次训练后，这里会显示你的进步。</p>
          </div>
        </div>
      `;
    }

    this.openSubpage("subpage-ex-detail");
  },

  openExerciseStats(id) {
    this.openExerciseDetail(id);
  },

  /* ---------- overlay / toast ---------- */
  openOverlay(html) {
    const o = document.getElementById("overlay");
    o.innerHTML = html;
    o.classList.add("visible");
    o.classList.add("center"); // default; sheets override alignment via sheet in flex-end... fix:
    // For sheets we want flex-end
    if (html.includes('class="sheet"')) {
      o.classList.remove("center");
    }
  },

  closeOverlay() {
    const o = document.getElementById("overlay");
    o.classList.remove("visible");
    o.innerHTML = "";
  },

  showToast(msg, type = "") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      t.classList.remove("show");
    }, 2400);
  },
};

// Fix overlay click: only close on backdrop
document.getElementById("overlay")?.addEventListener("click", function (e) {
  if (e.target === this) {
    this.classList.remove("visible");
    this.innerHTML = "";
  }
});

app.init();
