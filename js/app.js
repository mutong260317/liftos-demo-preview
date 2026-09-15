/* LiftOS UI controller — wires modules to DOM. */

window.LiftOS = window.LiftOS || {};

LiftOS.UI = (() => {
  const S = LiftOS.Storage;
  const W = LiftOS.Workout;
  const St = LiftOS.Stats;
  const P = LiftOS.Plans;
  const Pr = LiftOS.Progression;

  const state = {
    screen: "home",
    theme: "dark",
    session: null,
    libraryMode: "browse", // browse | addToWorkout | addToPlan | replaceExercise
    libraryReturn: null,
    editingPlanId: null,
    draftPlan: null,
    libMuscle: "all",
    libEquip: "all",
    dataRange: "7d",
    toastTimer: null,
    restTicker: null,
    workoutTicker: null,
    lastCompletedUndo: null, // { setIdx, expires }
    pendingReplace: null,
  };

  /* ---------- utils ---------- */
  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $all(sel, root = document) {
    return [...root.querySelectorAll(sel)];
  }
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmtClock(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }
  function fmtElapsed(ms) {
    const sec = Math.floor(ms / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  function cnDate(d = new Date()) {
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${days[d.getDay()]}`;
  }
  function greeting(d = new Date()) {
    const h = d.getHours();
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }

  function showToast(msg, type = "", action = null) {
    const t = $("#toast");
    if (action) {
      t.innerHTML = `${esc(msg)} <button class="toast-action" id="toastAction">${esc(action.label)}</button>`;
      $("#toastAction").onclick = () => {
        action.onClick();
        t.classList.remove("show");
      };
    } else {
      t.textContent = msg;
    }
    t.className = `toast show ${type}`;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => t.classList.remove("show"), action ? 5000 : 2400);
  }

  function openOverlay(html, { center = true } = {}) {
    const o = $("#overlay");
    o.innerHTML = html;
    o.classList.toggle("center", center && !html.includes('class="sheet"'));
    if (html.includes('class="sheet"')) o.classList.remove("center");
    o.classList.add("visible");
  }
  function closeOverlay() {
    const o = $("#overlay");
    o.classList.remove("visible");
    o.innerHTML = "";
  }

  function setTheme(mode) {
    state.theme = mode;
    document.documentElement.setAttribute("data-theme", mode);
    S.savePrefs({ theme: mode });
    const label = $("#themeLabel");
    if (label) label.textContent = mode === "dark" ? "深色" : "浅色";
    $all("[data-theme-btn]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-theme-btn") === mode));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#0B0D10" : "#F4F5F7");
  }

  /* ---------- navigation ---------- */
  function nav(name) {
    if (name === "training") return navTraining();
    state.screen = name;
    $all(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === name));
    $all(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.nav === name));
    $("#bottomNav").classList.remove("hidden");
    $all(".subpage").forEach((p) => p.classList.remove("active"));
    const sc = $(`.screen[data-screen="${name}"]`);
    if (sc) sc.scrollTop = 0;
    if (name === "home") renderHome();
    if (name === "plans") renderPlans();
    if (name === "data") renderData();
    if (name === "profile") renderProfile();
  }

  function navTraining() {
    state.session = S.getSession();
    if (!state.session) {
      const homePlan = P.all()[0];
      if (homePlan) startWorkoutFromPlan(homePlan.id);
      else showToast("还没有训练计划");
      return;
    }
    state.screen = "training";
    $all(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === "training"));
    $all(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.nav === "training"));
    $("#bottomNav").classList.add("hidden");
    startTickers();
    renderTraining();
  }

  function openSubpage(id) {
    $("#" + id).classList.add("active");
  }
  function closeSubpage(id) {
    $("#" + id).classList.remove("active");
  }

  /* ---------- HOME ---------- */
  function renderHome() {
    const prefs = S.getPrefs();
    const plans = P.all();
    const todayPlan = plans[0];
    const stats = todayPlan ? P.planStats(todayPlan) : null;

    $("#greetHello").textContent = `${greeting()} · ${cnDate()}`;
    $("#greetTitle").textContent = "今天准备练什么？";

    const session = S.getSession();
    const resume = $("#resumeBanner");
    if (session) {
      resume.classList.remove("hide");
      const done = St.workSetCount(session);
      const total = session.exercises.reduce((a, ex) => a + W.workSetsOf(ex).length, 0);
      const mins = Math.floor((Date.now() - session.startTime) / 60000);
      $("#resumePlan").textContent = session.planName;
      $("#resumeTime").textContent = `已训练 ${mins} 分钟 · 完成 ${done} / ${total} 组`;
      $("#resumeContinue").onclick = () => navTraining();
      $("#resumeEnd").onclick = () => confirmEndWorkout();
      $("#resumeAbandon").onclick = () => confirmAbandon();
    } else {
      resume.classList.add("hide");
    }

    const card = $("#todayCard");
    if (!todayPlan) {
      card.innerHTML = `
        <div class="plan-name">今日计划</div>
        <h2 style="margin-top:8px">今天暂无训练计划</h2>
        <p class="text-secondary mt-2" style="font-size:14px">创建计划或从模板开始。</p>
        <div class="mt-4" style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary btn-block" onclick="App.openCreatePlan()">选择计划</button>
          <button class="btn btn-secondary btn-block" onclick="App.openCreatePlan()">自由创建</button>
        </div>`;
      return;
    }

    card.innerHTML = `
      <div class="plan-name">今日计划</div>
      <h2>${esc(todayPlan.name)}</h2>
      <div class="meta">${esc(P.muscleLabelFromPlan(todayPlan))}</div>
      <div class="stats-row">
        <span><strong>${stats.minutes}</strong> 分钟</span>
        <span><strong>${stats.exerciseCount}</strong> 个动作</span>
        <span><strong>${stats.workSets}</strong> 组</span>
      </div>
      <button class="btn btn-primary btn-block btn-lg" onclick="App.startWorkoutFromPlan('${todayPlan.id}')">
        ${session ? "进入今日计划训练" : "开始训练"}
      </button>`;

    // week strip from history
    renderWeekStrip();
    renderHomeVolume();
    renderHomeMuscles();
    renderHomePrs();
  }

  function renderWeekStrip() {
    const hist = S.getHistory();
    const now = new Date();
    const day = now.getDay(); // 0 Sun
    const mondayOffset = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    const labels = ["一", "二", "三", "四", "五", "六", "日"];
    let doneCount = 0;
    let html = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = LiftOS.localDateKey(d);
      const done = hist.some((h) => h.date === key);
      const isToday = d.toDateString() === now.toDateString();
      if (done) doneCount += 1;
      html += `<div class="day-col ${done ? "done" : ""} ${isToday ? "today" : ""}">
        <span>${labels[i]}</span>
        <div class="dot">${done ? "✓" : isToday ? "今" : ""}</div>
      </div>`;
    }
    const target = S.getPrefs().weeklyTarget || 5;
    $("#weekTitleLink").textContent = `${doneCount} / ${target} 次`;
    $("#weekStrip").innerHTML = html;
  }

  function renderHomeVolume() {
    // current week volume from history
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    const startIso = LiftOS.localDateKey(monday);
    const hist = S.getHistory().filter((h) => h.date >= startIso);
    const prevMonday = new Date(monday.getTime() - 7 * 86400000);
    const prevStart = LiftOS.localDateKey(prevMonday);
    const prevEnd = startIso;
    const prev = S.getHistory().filter((h) => h.date >= prevStart && h.date < prevEnd);

    const vol = hist.reduce((a, h) => a + (h.volume || volumeOfHistory(h)), 0);
    const prevVol = prev.reduce((a, h) => a + (h.volume || volumeOfHistory(h)), 0);
    const delta = prevVol ? Math.round(((vol - prevVol) / prevVol) * 1000) / 10 : null;
    const mins = hist.reduce((a, h) => a + (h.durationMinutes || 45), 0);

    $("#homeVolume").textContent = vol.toLocaleString();
    $("#homeVolumeDelta").textContent = delta == null ? "本周" : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs 上周`;
    $("#homeVolumeDelta").className = `delta ${delta != null && delta < 0 ? "down" : ""}`;
    $("#homeHours").textContent = `${(mins / 60).toFixed(1)}h`;
  }

  function volumeOfHistory(h) {
    let v = 0;
    (h.exercises || []).forEach((ex) => (ex.sets || []).forEach((s) => (v += (s.weight || 0) * (s.reps || 0))));
    return v;
  }

  function renderHomeMuscles() {
    const map = St.weeklyMuscleSets("7d");
    const order = ["chest", "back", "quads", "side_delts", "biceps", "triceps"];
    const max = Math.max(10, ...Object.values(map));
    $("#homeMuscles").innerHTML = order
      .map((m) => {
        const n = map[m] || 0;
        const label = LiftOS.MuscleLabels[m] || m;
        const pct = Math.round((n / max) * 100);
        return `<div class="muscle-row"><span class="name">${label}</span><span class="count">${n}组</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
      })
      .join("");
  }

  function renderHomePrs() {
    // recent PRs from history sessions that look strong + seed cues
    const items = [];
    const hackBest = St.bestSet("hack_squat");
    if (hackBest) items.push({ name: "哈克深蹲", detail: `${hackBest.weight} kg × ${hackBest.reps}`, badge: "Weight PR" });
    const benchBest = St.bestSet("bench");
    if (benchBest) items.push({ name: "杠铃卧推", detail: `${benchBest.weight} kg × ${benchBest.reps}`, badge: "Weight PR" });
    const inclineBest = St.bestSet("incline");
    if (inclineBest) items.push({ name: "上斜哑铃卧推", detail: `${inclineBest.weight} kg × ${inclineBest.reps}`, badge: "Weight PR" });

    $("#homePrs").innerHTML = items
      .map(
        (p) => `<div class="pr-item">
          <div><div class="ex-name">${esc(p.name)}</div><div class="ex-detail">${esc(p.detail)}</div></div>
          <span class="badge-pr">${esc(p.badge)}</span>
        </div>`
      )
      .join("");
  }

  /* ---------- PLANS ---------- */
  function renderPlans() {
    const plans = P.all();
    const list = $("#plansList");
    if (!plans.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          <h3>还没有训练计划</h3>
          <p>创建计划后可以一键开始训练。</p>
          <div class="empty-actions">
            <button class="btn btn-primary" onclick="App.openCreatePlan()">创建计划</button>
          </div>
        </div>`;
      return;
    }
    list.innerHTML = plans
      .map((p, i) => {
        const s = P.planStats(p);
        return `<div class="plan-card" onclick="App.openPlanDetail('${p.id}')">
          <div class="top">
            <h3>${esc(p.name)}</h3>
            ${i === 0 ? '<span class="tag">优先</span>' : ""}
          </div>
          <div class="desc">${esc(p.muscleLabel || P.muscleLabelFromPlan(p))}</div>
          <div class="ex-count">${s.exerciseCount} 个动作 · ${s.workSets} 组 · 约 ${s.minutes} 分钟</div>
        </div>`;
      })
      .join("");
  }

  function openPlanDetail(planId) {
    const plan = P.get(planId);
    if (!plan) return;
    state.editingPlanId = planId;
    $("#planDetailTitle").textContent = plan.name;
    $("#planDetailBody").innerHTML = `
      <p class="text-secondary mb-3" style="font-size:14px">${esc(plan.muscleLabel || P.muscleLabelFromPlan(plan))}</p>
      <div class="card">
        ${plan.exercises
          .map((pe, i) => {
            const m = LiftOS.getExercise(pe.exerciseId);
            return `<div class="plan-day-item">
              <div class="idx">${i + 1}</div>
              <div class="info" style="cursor:pointer" onclick="App.openPlanExEditor('${planId}',${i})">
                <div class="name">${esc(m?.name || pe.exerciseId)}</div>
                <div class="sets">${pe.workSets} × ${pe.repMin}-${pe.repMax} · 休息 ${pe.restSeconds}s · RIR ${pe.targetRirMin}-${pe.targetRirMax}</div>
                <div class="sets" style="color:var(--accent);font-weight:600">编辑参数</div>
              </div>
              <button class="icon-btn" aria-label="删除动作" onclick="event.stopPropagation();App.removePlanEx('${planId}',${i})">
                <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>`;
          })
          .join("")}
      </div>
      <button class="btn btn-secondary btn-block mt-3" onclick="App.setLibraryMode('addToPlan','${planId}')">+ 添加动作</button>
      <button class="btn btn-primary btn-block btn-lg mt-3" onclick="App.startWorkoutFromPlan('${planId}')">用此计划开始</button>
      <button class="btn btn-danger btn-block mt-2" onclick="App.confirmDeletePlan('${planId}')">删除计划</button>
    `;
    openSubpage("subpage-plan");
  }

  function openCreatePlan() {
    state.draftPlan = {
      name: "",
      goal: "增肌",
      exercises: [],
    };
    renderCreatePlan();
    openSubpage("subpage-create-plan");
  }

  function renderCreatePlan() {
    const d = state.draftPlan;
    $("#createPlanName").value = d.name || "";
    $all("#goalSeg button").forEach((b) => b.classList.toggle("active", b.textContent === (d.goal || "增肌")));
    const list = d.exercises
      .map((e, i) => {
        const m = LiftOS.getExercise(e.exerciseId);
        return `<div class="plan-day-item">
          <div class="idx">${i + 1}</div>
          <div class="info" style="cursor:pointer" onclick="App.openDraftExEditor(${i})">
            <div class="name">${esc(m?.name || e.exerciseId)}</div>
            <div class="sets">${e.workSets} × ${e.repMin}-${e.repMax} · 休息 ${e.restSeconds}s · RIR ${e.targetRirMin}-${e.targetRirMax}</div>
            <div class="sets" style="color:var(--accent);font-weight:600">编辑参数</div>
          </div>
          <button class="icon-btn" aria-label="移除" onclick="App.draftRemoveEx(${i})">×</button>
        </div>`;
      })
      .join("");
    $("#createPlanExList").innerHTML = list || `<p class="text-secondary" style="font-size:13px;padding:8px 0">尚未添加动作</p>`;
  }

  function openDraftExEditor(i) {
    const e = state.draftPlan?.exercises[i];
    if (!e) return;
    const m = LiftOS.getExercise(e.exerciseId);
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()" style="max-width:340px">
        <h3>${esc(m?.name || "")} 参数</h3>
        <div class="form-group" style="text-align:left">
          <label>工作组</label>
          <input class="form-input" id="peSets" type="number" min="1" max="10" value="${e.workSets}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left">
          <div class="form-group"><label>次数下限</label><input class="form-input" id="peMin" type="number" value="${e.repMin}" /></div>
          <div class="form-group"><label>次数上限</label><input class="form-input" id="peMax" type="number" value="${e.repMax}" /></div>
          <div class="form-group"><label>RIR 下限</label><input class="form-input" id="peRirMin" type="number" min="0" max="4" value="${e.targetRirMin}" /></div>
          <div class="form-group"><label>RIR 上限</label><input class="form-input" id="peRirMax" type="number" min="0" max="4" value="${e.targetRirMax}" /></div>
          <div class="form-group" style="grid-column:1/-1"><label>休息（秒）</label><input class="form-input" id="peRest" type="number" min="15" step="15" value="${e.restSeconds}" /></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="App.saveDraftExEditor(${i})">保存参数</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
  }

  function saveDraftExEditor(i) {
    const e = state.draftPlan.exercises[i];
    e.workSets = Math.max(1, parseInt($("#peSets").value, 10) || e.workSets);
    e.repMin = Math.max(1, parseInt($("#peMin").value, 10) || e.repMin);
    e.repMax = Math.max(e.repMin, parseInt($("#peMax").value, 10) || e.repMax);
    e.targetRirMin = Math.max(0, Math.min(4, parseInt($("#peRirMin").value, 10) || 0));
    e.targetRirMax = Math.max(e.targetRirMin, Math.min(4, parseInt($("#peRirMax").value, 10) || 0));
    e.restSeconds = Math.max(15, parseInt($("#peRest").value, 10) || e.restSeconds);
    closeOverlay();
    renderCreatePlan();
    showToast("动作参数已更新");
  }

  function openPlanExEditor(planId, index) {
    const plan = P.get(planId);
    const e = plan?.exercises?.[index];
    if (!e) return;
    const m = LiftOS.getExercise(e.exerciseId);
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()" style="max-width:340px">
        <h3>${esc(m?.name || "")} 参数</h3>
        <div class="form-group" style="text-align:left">
          <label>工作组</label>
          <input class="form-input" id="peSets" type="number" min="1" max="10" value="${e.workSets}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left">
          <div class="form-group"><label>次数下限</label><input class="form-input" id="peMin" type="number" value="${e.repMin}" /></div>
          <div class="form-group"><label>次数上限</label><input class="form-input" id="peMax" type="number" value="${e.repMax}" /></div>
          <div class="form-group"><label>RIR 下限</label><input class="form-input" id="peRirMin" type="number" min="0" max="4" value="${e.targetRirMin}" /></div>
          <div class="form-group"><label>RIR 上限</label><input class="form-input" id="peRirMax" type="number" min="0" max="4" value="${e.targetRirMax}" /></div>
          <div class="form-group" style="grid-column:1/-1"><label>休息（秒）</label><input class="form-input" id="peRest" type="number" min="15" step="15" value="${e.restSeconds}" /></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="App.savePlanExEditor('${planId}', ${index})">保存参数</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
  }

  function savePlanExEditor(planId, index) {
    const plan = P.get(planId);
    if (!plan) return;
    const list = plan.exercises.map((e) => ({ ...e }));
    const e = list[index];
    e.workSets = Math.max(1, parseInt($("#peSets").value, 10) || e.workSets);
    e.repMin = Math.max(1, parseInt($("#peMin").value, 10) || e.repMin);
    e.repMax = Math.max(e.repMin, parseInt($("#peMax").value, 10) || e.repMax);
    e.targetRirMin = Math.max(0, Math.min(4, parseInt($("#peRirMin").value, 10) || 0));
    e.targetRirMax = Math.max(e.targetRirMin, Math.min(4, parseInt($("#peRirMax").value, 10) || 0));
    e.restSeconds = Math.max(15, parseInt($("#peRest").value, 10) || e.restSeconds);
    P.update(planId, { exercises: list });
    closeOverlay();
    openPlanDetail(planId);
    showToast("计划动作参数已保存");
  }

  function saveDraftPlan() {
    const name = ($("#createPlanName").value || "新计划").trim();
    const goal = $("#goalSeg button.active")?.textContent || "增肌";
    if (!state.draftPlan.exercises.length) {
      showToast("请至少添加一个动作");
      return;
    }
    const muscleLabel = goal;
    const plan = P.create({
      name,
      muscleLabel: `${muscleLabel} · 自定义`,
      exercises: state.draftPlan.exercises,
    });
    closeSubpage("subpage-create-plan");
    showToast("计划已保存");
    renderPlans();
    openPlanDetail(plan.id);
  }

  /* ---------- WORKOUT ---------- */
  function startWorkoutFromPlan(planId) {
    const plan = P.get(planId);
    if (!plan) {
      showToast("计划不存在");
      return;
    }
    const existing = S.getSession();
    if (existing && existing.planId !== planId) {
      openOverlay(`
        <div class="modal" onclick="event.stopPropagation()">
          <h3>已有进行中的训练</h3>
          <p>${esc(existing.planName)} 尚未结束。开始新的计划会放弃当前进度。</p>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="App.forceStart('${planId}')">放弃并开始 ${esc(plan.name)}</button>
            <button class="btn btn-ghost" onclick="App.closeOverlay();App.navTraining()">继续当前训练</button>
          </div>
        </div>`);
      return;
    }
    if (existing) {
      state.session = existing;
      navTraining();
      return;
    }
    const session = W.createFromPlan(plan);
    S.saveSession(session);
    state.session = session;
    closeSubpage("subpage-plan");
    showToast(`开始 ${plan.name}`);
    navTraining();
  }

  function forceStart(planId) {
    closeOverlay();
    S.clearSession();
    const plan = P.get(planId);
    const session = W.createFromPlan(plan);
    S.saveSession(session);
    state.session = session;
    closeSubpage("subpage-plan");
    navTraining();
  }

  function startTickers() {
    clearInterval(state.workoutTicker);
    clearInterval(state.restTicker);
    state.workoutTicker = setInterval(() => {
      if (!state.session) return;
      const el = $("#workoutTimer");
      if (el) el.textContent = fmtElapsed(Date.now() - state.session.startTime);
      tickRest();
    }, 500);
  }

  function tickRest() {
    const bar = $("#restBar");
    if (!state.session?.rest) {
      bar.classList.remove("visible");
      return;
    }
    const remain = W.restRemaining(state.session);
    if (remain <= 0) {
      W.clearRest(state.session);
      bar.classList.remove("visible", "ending");
      showToast("休息结束");
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      renderTraining();
      return;
    }
    bar.classList.add("visible");
    bar.classList.toggle("ending", remain <= 10);
    $("#restTime").textContent = fmtClock(remain);
  }

  function renderTraining() {
    const session = state.session;
    if (!session) return;
    const ex = W.currentEx(session);
    if (!ex) {
      endWorkout();
      return;
    }

    $("#trainingPlanLabel").textContent = session.planName;
    $("#workoutTimer").textContent = fmtElapsed(Date.now() - session.startTime);
    $("#exProgressLabel").textContent = `${session.exIndex + 1} / ${session.exercises.length} 动作`;

    const totalWork = session.exercises.reduce((a, e) => a + W.workSetsOf(e).length, 0);
    const doneWork = session.exercises.reduce((a, e) => a + W.workSetsOf(e).filter((s) => s.completed).length, 0);
    $("#setProgressFill").style.width = `${totalWork ? (doneWork / totalWork) * 100 : 0}%`;

    const workDone = W.allWorkDone(ex);
    $("#exLoggingView").classList.toggle("hide", workDone);
    $("#exCompleteView").classList.toggle("hide", !workDone);

    if (workDone) {
      const work = W.workSetsOf(ex).filter((s) => s.completed);
      const vol = work.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0);
      const lastVol = lastVolumeFor(ex.exerciseId);
      $("#doneExName").textContent = ex.name;
      $("#doneExSets").textContent = `${work.length} / ${work.length} 组完成`;
      $("#doneVolume").textContent = `${vol.toLocaleString()} kg`;
      const deltaEl = $("#doneDelta");
      if (lastVol > 0) {
        const d = Math.round(((vol - lastVol) / lastVol) * 1000) / 10;
        deltaEl.textContent = `${d >= 0 ? "↑" : "↓"} ${Math.abs(d)}%`;
        deltaEl.className = `v ${d >= 0 ? "text-success" : "text-danger"}`;
      } else {
        deltaEl.textContent = "—";
        deltaEl.className = "v";
      }
      const vpr = St.detectVolumePR(ex.exerciseId, ex.sets, []);
      if (vpr) {
        session.prs = session.prs || [];
        if (!session.prs.some((p) => p.type === "volume" && p.exerciseId === ex.exerciseId)) {
          session.prs.push({ ...vpr, exerciseId: ex.exerciseId, exerciseName: ex.name });
          W.save(session);
          showToast(`${vpr.label} · ${vpr.detail}`, "pr");
        }
      }
      $("#nextExBtn").textContent = session.exIndex >= session.exercises.length - 1 ? "结束训练" : "下一动作";
    }

    $("#exName").textContent = ex.name;
    $("#exMuscle").textContent = ex.muscle;

    const pe = ex.planExercise;
    const best = St.bestSet(ex.exerciseId);
    const bestTxt = best ? `${best.weight}kg × ${best.reps}` : "无记录";
    $("#historyStrip").innerHTML = `
      <div class="chip">上次最佳 <strong>${esc(bestTxt)}</strong></div>
      <div class="chip advice">建议重量 <strong>${ex.sets.find((s) => s.type === "work")?.weight ?? "—"}kg</strong></div>
      <div class="chip">目标 <strong>${pe.repMin}-${pe.repMax}次</strong></div>
      <div class="chip">RIR <strong>${pe.targetRirMin}-${pe.targetRirMax}</strong></div>`;

    const advice = ex.advice;
    const adviceCard = $("#adviceCard");
    if (advice) {
      adviceCard.classList.remove("hide");
      $("#adviceTag").textContent = Pr.actionLabel(advice.action);
      $("#adviceTitle").textContent = advice.action === "increase" ? "上次接近目标上限" : advice.action === "start" ? "建立动作模式" : "根据最近表现";
      $("#adviceBody").textContent = advice.reason;
    } else adviceCard.classList.add("hide");

    $("#notesInput").value = ex.notes || StorageNote(ex.exerciseId);
    renderSetList();
    tickRest();
  }

  function StorageNote(id) {
    return S.getNote(id) || "";
  }

  function lastVolumeFor(exerciseId) {
    const rows = St.exerciseHistory(exerciseId);
    if (!rows.length) return 0;
    return rows[0].sets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0);
  }

  function renderSetList() {
    const session = state.session;
    const ex = W.currentEx(session);
    if (!ex) return;
    const activeIdx = W.activeSetIndex(session);
    const best = St.bestSet(ex.exerciseId);
    const lastSets = St.exerciseHistory(ex.exerciseId)[0]?.sets || [];

    $("#setList").innerHTML = ex.sets
      .map((set, i) => {
        const isActive = i === activeIdx;
        const isDone = set.completed;
        const isWarm = set.type === "warmup";
        const label = isWarm ? "热身" : String(set.num);

        if (isActive) {
          const sugReps = pickSuggestReps(ex, set, lastSets, i);
          const bw = LiftOS.isBodyweight(ex.exerciseId);
          const inc = incOf(ex) || 2.5;
          const weightBlock = bw
            ? `
              <div class="stepper-block">
                <div class="label">负荷 <span class="suggest-hint">自重默认 0kg，可加附加负重</span></div>
                <div class="stepper">
                  <button class="stepper-btn fast" aria-label="减少附加负重" onclick="App.stepWeight(${i}, -${inc})">−${inc}</button>
                  <div class="stepper-value" role="button" aria-label="编辑附加负重" onclick="App.openWeightInput(${i})">
                    <span id="wDisplay">${set.weight == null ? 0 : set.weight}</span><span class="unit">${set.weight > 0 ? "kg" : "自重"}</span>
                  </div>
                  <button class="stepper-btn fast" aria-label="增加附加负重" onclick="App.stepWeight(${i}, ${inc})">+${inc}</button>
                </div>
              </div>`
            : `
              <div class="stepper-block">
                <div class="label">重量</div>
                <div class="stepper">
                  <button class="stepper-btn fast" aria-label="减少重量" onclick="App.stepWeight(${i}, -${incOf(ex)})">−${incOf(ex)}</button>
                  <div class="stepper-value" role="button" aria-label="编辑重量" onclick="App.openWeightInput(${i})">
                    <span id="wDisplay">${set.weight == null ? "—" : set.weight}</span><span class="unit">kg</span>
                  </div>
                  <button class="stepper-btn fast" aria-label="增加重量" onclick="App.stepWeight(${i}, ${incOf(ex)})">+${incOf(ex)}</button>
                </div>
              </div>`;
          return `
          <div class="set-card active" data-set="${i}">
            <div class="set-editor">
              <div class="set-label">${isWarm ? "热身组" : `第 ${set.num} 组`}${bw ? " · 自重" : ""}</div>
              <div class="last-best">上次最佳 ${esc(best ? (best.weight > 0 ? `${best.weight}kg × ${best.reps}` : `${best.reps} 次`) : "无")} · 目标 ${ex.planExercise.repMin}-${ex.planExercise.repMax} 次</div>

              ${weightBlock}

              <div class="stepper-block">
                <div class="label">次数 ${sugReps != null ? `<span class="suggest-hint">建议 ${sugReps}（未确认）</span>` : ""}</div>
                <div class="stepper">
                  <button class="stepper-btn" aria-label="减少次数" onclick="App.stepReps(${i}, -1)">−</button>
                  <div class="stepper-value ${set.reps == null ? "placeholder" : ""}" role="button" aria-label="编辑次数" onclick="App.openRepsInput(${i})">
                    <span id="rDisplay">${set.reps == null ? (sugReps != null ? `<span class="suggest-value">${sugReps}</span>` : "—") : set.reps}</span><span class="unit">次</span>
                  </div>
                  <button class="stepper-btn" aria-label="增加次数" onclick="App.stepReps(${i}, 1)">+</button>
                </div>
              </div>

              <div class="stepper-block">
                <div class="label">RIR <span class="suggest-hint">可留空为未记录</span></div>
                <div class="rir-row">
                  ${[4, 3, 2, 1, 0, null]
                    .map((r) => {
                      const sel = set.rir === r;
                      const txt = r === null ? "未记录" : r === 4 ? "4+" : String(r);
                      return `<button class="rir-btn ${sel ? "selected" : ""}" aria-label="RIR ${txt}" onclick="App.setRir(${i}, ${r === null ? "null" : r})">${txt}</button>`;
                    })
                    .join("")}
                </div>
              </div>

              <button class="complete-set-btn" id="completeBtn" onclick="App.completeSet(${i})">
                ✓ 完成本组
              </button>
              <p class="complete-hint" id="completeHint">需填写真实次数后才能完成</p>
            </div>
          </div>`;
        }

        const prevLast = !isWarm && lastSets[i - (ex.sets.findIndex((s) => s.type === "work"))];
        const prevLabel = isWarm
          ? "热身"
          : best
            ? `${best.weight}×${best.reps}`
            : "—";

        return `
        <div class="set-card ${isDone ? "done" : ""}" data-set="${i}">
          <div class="set-row-compact ${isDone ? "done-set" : ""}">
            <div class="set-num">${label}</div>
            <div class="prev"><strong>${esc(prevLabel)}</strong></div>
            <button class="set-num-display ${isDone ? "" : "placeholder"}" aria-label="重量 ${set.weight ?? "空"}" onclick="App.focusSet(${i})">${set.weight ?? "—"}</button>
            <button class="set-num-display ${isDone ? "" : "placeholder"}" aria-label="次数 ${set.reps ?? "空"}" onclick="App.focusSet(${i})">${isDone ? set.reps : set.reps ?? "—"}</button>
            <button class="complete-dot ${isDone ? "done" : ""}" aria-label="${isDone ? "撤销完成" : "完成本组"}" onclick="${isDone ? `App.requestUndo(${i})` : `App.focusSet(${i})`}">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </div>
          ${isDone ? `<div class="set-done-meta">${set.weight > 0 ? set.weight + "kg" : "自重"} × ${set.reps}${set.rir != null ? ` · RIR ${set.rir}` : " · RIR 未记录"}</div>` : ""}
        </div>`;
      })
      .join("");
  }

  function pickSuggestReps(ex, set, lastSets, i) {
    // Do NOT write into set.reps. Display-only suggestion.
    if (set.reps != null) return null;
    const prevWork = ex.sets.slice(0, i).reverse().find((s) => s.completed && s.type === "work");
    if (prevWork && prevWork.reps != null) return prevWork.reps;
    const mid = Math.round((ex.planExercise.repMin + ex.planExercise.repMax) / 2);
    return mid;
  }

  function incOf(ex) {
    return LiftOS.getExercise(ex.exerciseId)?.defaultIncrement ?? 2.5;
  }

  function stepWeight(i, delta) {
    const ex = W.currentEx(state.session);
    const set = ex.sets[i];
    const bw = LiftOS.isBodyweight(ex.exerciseId);
    const base = set.weight == null ? (bw ? 0 : ex.sets.find((s) => s.weight != null)?.weight ?? 20) : set.weight;
    set.weight = Math.max(0, Math.round((base + delta) * 10) / 10);
    W.save(state.session);
    const el = $("#wDisplay");
    if (el) {
      el.textContent = set.weight;
      const unit = el.parentElement?.querySelector(".unit");
      if (unit && bw) unit.textContent = set.weight > 0 ? "kg" : "自重";
    }
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function stepReps(i, delta) {
    const ex = W.currentEx(state.session);
    const set = ex.sets[i];
    const sug = pickSuggestReps(ex, set, [], i);
    if (set.reps == null) set.reps = Math.max(0, (sug ?? 0) + delta);
    else set.reps = Math.max(0, set.reps + delta);
    W.save(state.session);
    const el = $("#rDisplay");
    if (el) el.textContent = set.reps;
    if (navigator.vibrate) navigator.vibrate(8);
    renderSetList();
  }

  function setRir(i, rir) {
    const ex = W.currentEx(state.session);
    ex.sets[i].rir = rir; // null = 未记录
    W.save(state.session);
    $all(".rir-btn").forEach((b) => {
      const label = b.textContent.trim();
      const val = label === "未记录" ? null : label === "4+" ? 4 : Number(label);
      b.classList.toggle("selected", val === rir || (rir === 4 && label === "4+"));
    });
  }

  function focusSet(i) {
    const session = state.session;
    const ex = W.currentEx(session);
    if (!ex || ex.sets[i].completed) return;
    // only first incomplete set is editable focus
    const active = W.activeSetIndex(session);
    if (i !== active) {
      // jump by completing earlier? simpler: only activate if all before completed
      showToast("请先完成前面的组");
      return;
    }
    renderSetList();
  }

  function completeSet(i) {
    const ex = W.currentEx(state.session);
    const set = ex.sets[i];
    if (set.reps == null || set.reps <= 0) {
      showToast("请先填写真实次数");
      const hint = $("#completeHint");
      if (hint) hint.classList.add("warn");
      return;
    }
    // write rir from UI if selected — already on set
    const result = W.completeSet(state.session, i, {
      weight: set.weight,
      reps: set.reps,
      rir: set.rir, // may be null
    });
    if (!result.ok) {
      showToast(result.error || "无法完成");
      return;
    }
    if (result.prs?.length) {
      const p = result.prs[0];
      showToast(`${p.label} · ${p.detail}`, "pr");
    } else {
      showToast(`已完成 ${set.weight}kg × ${set.reps}`, "", {
        label: "撤销",
        onClick: () => requestUndo(i),
      });
    }
    if (navigator.vibrate) navigator.vibrate(18);
    renderTraining();
  }

  function requestUndo(i) {
    const ex = W.currentEx(state.session);
    const set = ex.sets[i];
    if (!set?.completed) return;
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>撤销完成？</h3>
        <p>${set.weight}kg × ${set.reps}${set.rir != null ? ` · RIR ${set.rir}` : ""}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="App.doUndo(${i})">撤销</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
  }

  function doUndo(i) {
    const r = W.undoSet(state.session, i);
    closeOverlay();
    if (r.ok) {
      showToast("已撤销");
      renderTraining();
    } else showToast(r.error || "撤销失败");
  }

  function nextExercise() {
    const ok = W.nextExercise(state.session);
    if (!ok) {
      endWorkout();
      return;
    }
    renderTraining();
  }

  function skipExercise() {
    W.skipExercise(state.session);
    renderTraining();
  }

  function addExercise() {
    setLibraryMode("addToWorkout");
  }

  function openReplaceSheet() {
    const ex = W.currentEx(state.session);
    const candidates = LiftOS.Exercises.filter((e) => e.id !== ex.exerciseId).slice(0, 12);
    openOverlay(`
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3>替换动作</h3>
          <button class="btn btn-ghost btn-sm" onclick="App.closeOverlay()">关闭</button>
        </div>
        <div class="sheet-body">
          <p class="text-secondary mb-3" style="font-size:13px">当前：${esc(ex.name)} · 点击后确认参数</p>
          ${candidates
            .map(
              (r) => `<button class="replace-item" onclick="App.previewReplace('${r.id}')">
                <div><div class="name">${esc(r.name)}</div><div class="muscle">${esc(r.muscleLabel)}</div></div>
                <span class="text-accent">选择</span>
              </button>`
            )
            .join("")}
        </div>
      </div>`);
  }

  function previewReplace(newId) {
    const ex = W.currentEx(state.session);
    const master = LiftOS.getExercise(newId);
    const old = ex.planExercise;
    const nd = master.defaultParams || { workSets: 3, repMin: 8, repMax: 12, restSeconds: 90, targetRirMin: 1, targetRirMax: 2 };
    state.pendingReplace = { newId, mode: null };
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()" style="max-width:340px;text-align:left">
        <h3 style="text-align:center">替换动作</h3>
        <p style="text-align:center">${esc(ex.name)}<br/>↓<br/><strong>${esc(master.name)}</strong></p>
        <div class="card mb-3" style="background:var(--bg-input)">
          <div class="text-secondary" style="font-size:12px;margin-bottom:8px">训练参数</div>
          <div style="font-size:14px;line-height:1.7">
            工作组 <strong>${old.workSets}</strong> → 该动作默认 <strong>${nd.workSets}</strong><br/>
            次数 <strong>${old.repMin}-${old.repMax}</strong> → <strong>${nd.repMin}-${nd.repMax}</strong><br/>
            休息 <strong>${old.restSeconds}s</strong> → <strong>${nd.restSeconds}s</strong><br/>
            RIR <strong>${old.targetRirMin}-${old.targetRirMax}</strong> → <strong>${nd.targetRirMin}-${nd.targetRirMax}</strong>
          </div>
          <p class="mt-2" style="font-size:12px;color:var(--text-tertiary)">个人备注不会带入新动作。</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="App.applyReplace('reuse')">沿用当前参数</button>
          <button class="btn btn-primary" onclick="App.applyReplace('default')">使用该动作默认参数</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
  }

  function applyReplace(mode) {
    if (!state.pendingReplace) return;
    W.replaceExercise(state.session, state.pendingReplace.newId, mode);
    state.pendingReplace = null;
    closeOverlay();
    renderTraining();
    showToast("已替换动作，备注独立");
  }

  function openWorkoutProgress() {
    if (!state.session) return;
    const rows = state.session.exercises
      .map((ex, i) => {
        const work = W.workSetsOf(ex);
        const done = work.filter((s) => s.completed).length;
        let cls = "todo";
        let icon = "○";
        if (ex.skipped) {
          icon = "—";
        } else if (done === work.length && work.length) {
          cls = "done";
          icon = "✓";
        } else if (i === state.session.exIndex) {
          cls = "current";
          icon = "●";
        }
        return `<div class="item">
          <div class="status-icon ${cls}">${icon}</div>
          <div class="name">${esc(ex.name)}</div>
          <div class="count">${done}/${work.length}</div>
        </div>`;
      })
      .join("");
    openOverlay(`
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3>训练进度 · ${esc(state.session.planName)}</h3>
          <button class="btn btn-ghost btn-sm" onclick="App.closeOverlay()">关闭</button>
        </div>
        <div class="sheet-body">
          <div class="progress-list">${rows}</div>
          <button class="btn btn-secondary btn-block mt-4" onclick="App.closeOverlay();App.addExercise()">+ 添加动作</button>
          <button class="btn btn-danger btn-block mt-2" onclick="App.confirmEndWorkout()">结束训练</button>
        </div>
      </div>`);
  }

  function confirmEndWorkout() {
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>结束训练？</h3>
        <p>将根据真实完成的组保存训练总结。</p>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="App.endWorkout()">结束并总结</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">继续训练</button>
        </div>
      </div>`);
  }

  function confirmAbandon() {
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>放弃训练？</h3>
        <p>当前进度不会写入历史，且无法恢复。</p>
        <div class="modal-actions">
          <button class="btn btn-danger" onclick="App.abandonWorkout()">放弃</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
  }

  function abandonWorkout() {
    W.abandon();
    state.session = null;
    closeOverlay();
    showToast("已放弃训练");
    nav("home");
  }

  function endWorkout() {
    closeOverlay();
    const session = state.session || S.getSession();
    if (!session) {
      nav("home");
      return;
    }
    session.endTime = Date.now();
    // do not finish yet — show summary first with live data; save on finishSummary
    renderSummary(session);
    $all(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === "summary"));
    $("#bottomNav").classList.add("hidden");
    state.screen = "summary";
    clearInterval(state.workoutTicker);
    W.clearRest(session);
  }

  function renderSummary(session) {
    const m = W.summaryModel(session);
    $("#sumTime").textContent = fmtElapsed(m.durationMs);
    $("#sumEx").textContent = m.exercises;
    $("#sumSets").textContent = m.workSets;
    $("#sumVol").textContent = m.volume.toLocaleString();
    $("#sumPr").textContent = m.prs.length;
    $("#sumRir").textContent = m.avgRir == null ? "未记录" : m.avgRir;

    const muscleOrder = ["chest", "front_delts", "side_delts", "triceps", "back", "quads", "biceps", "core"];
    const entries = muscleOrder.filter((k) => m.muscles[k]).map((k) => [k, m.muscles[k]]);
    const max = Math.max(1, ...entries.map((e) => e[1]));
    $("#sumMuscles").innerHTML = entries
      .map(
        ([k, n]) =>
          `<div class="muscle-row"><span class="name">${LiftOS.MuscleLabels[k] || k}</span><span class="count">${n}组</span>
           <div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></div></div></div>`
      )
      .join("") || `<p class="text-secondary" style="font-size:13px">无完成工作组</p>`;

    $("#todayPrList").innerHTML = m.prs.length
      ? m.prs
          .map(
            (p) => `<div class="pr-item">
              <div><div class="ex-name">${esc(p.exerciseName || "")}</div>
              <div class="ex-detail">${esc(p.detail)}</div></div>
              <span class="badge-pr">${esc(p.label)}</span>
            </div>`
          )
          .join("")
      : `<div class="text-secondary" style="font-size:13px;padding:8px 0">本次未刷新个人纪录。</div>`;

    $all(".feeling-btn").forEach((b) => b.classList.remove("selected"));
  }

  function setFeeling(n) {
    $all(".feeling-btn").forEach((b) => b.classList.toggle("selected", +b.dataset.feel === n));
    if (state.session) state.session.feeling = n;
  }

  function finishSummary() {
    const session = state.session || S.getSession();
    if (!session) {
      nav("home");
      return;
    }
    const note = $("#sumNote").value;
    const feeling = $(".feeling-btn.selected")?.dataset.feel;
    const entry = W.finish(session, { note, feeling: feeling ? +feeling : null });
    state.session = null;
    showToast("训练已保存");
    nav("home");
  }

  /* ---------- LIBRARY ---------- */
  function setLibraryMode(mode, arg) {
    state.libraryMode = mode;
    state.libraryReturn = arg || null;
    if (mode === "addToPlan") state.editingPlanId = arg || state.editingPlanId;
    renderLibrary();
    openSubpage("subpage-library");
    const banner = $("#libModeBanner");
    const labels = {
      browse: "",
      addToWorkout: "选择要添加到当前训练的动作",
      addToPlan: "选择要添加到计划的动作",
      replaceExercise: "选择替换动作",
    };
    banner.textContent = labels[mode] || "";
    banner.classList.toggle("hide", mode === "browse");
  }

  function renderLibrary() {
    const q = ($("#libSearch")?.value || "").trim().toLowerCase();
    const list = LiftOS.Exercises.filter((ex) => {
      if (state.libMuscle !== "all") {
        const hit = [...(ex.primaryMuscles || []), ...(ex.secondaryMuscles || [])].includes(state.libMuscle);
        const alias = state.libMuscle === "shoulders" && (ex.muscleLabel || "").includes("肩");
        if (!hit && !alias) return false;
      }
      if (state.libEquip !== "all" && ex.equipment !== state.libEquip) return false;
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      return true;
    });

    const el = $("#libraryList");
    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>没有匹配动作</h3><p>试试更换筛选</p></div>`;
      return;
    }
    el.innerHTML = list
      .map(
        (ex) => `<div class="ex-card" onclick="App.onLibraryClick('${ex.id}')" role="button" tabindex="0">
          <h3>${esc(ex.name)}</h3>
          <div class="muscles">${esc(ex.muscleLabel)}</div>
          <span class="equip">${esc(LiftOS.EquipLabels[ex.equipment] || ex.equipment)}</span>
        </div>`
      )
      .join("");
  }

  function onLibraryClick(exerciseId) {
    if (state.libraryMode === "browse") {
      openExerciseDetail(exerciseId);
      return;
    }
    if (state.libraryMode === "addToWorkout") {
      confirmAddToWorkout(exerciseId);
      return;
    }
    if (state.libraryMode === "addToPlan") {
      confirmAddToPlan(exerciseId);
      return;
    }
    if (state.libraryMode === "replaceExercise") {
      closeSubpage("subpage-library");
      previewReplace(exerciseId);
    }
  }

  function confirmAddToWorkout(exerciseId) {
    const master = LiftOS.getExercise(exerciseId);
    const d = master.defaultParams || { workSets: 3, repMin: 8, repMax: 12, restSeconds: 90 };
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>添加「${esc(master.name)}」？</h3>
        <p>工作组：${d.workSets}<br/>目标次数：${d.repMin}–${d.repMax}<br/>休息：${d.restSeconds}秒${master.equipment === "bodyweight" ? "<br/>负荷：自重 (0kg)" : ""}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="App.doAddToWorkout('${exerciseId}')">确认添加</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
  }

  function doAddToWorkout(exerciseId) {
    if (!state.session) {
      showToast("没有进行中的训练");
      closeOverlay();
      return;
    }
    W.addExerciseToSession(state.session, exerciseId, {});
    closeOverlay();
    closeSubpage("subpage-library");
    state.libraryMode = "browse";
    showToast("已添加到当前训练");
    renderTraining();
  }

  function confirmAddToPlan(exerciseId) {
    const master = LiftOS.getExercise(exerciseId);
    const pe = P.resolvePlanExerciseParams(exerciseId);
    if (state.draftPlan && $("#subpage-create-plan").classList.contains("active")) {
      state.draftPlan.exercises.push({
        exerciseId,
        ...pe,
      });
      closeSubpage("subpage-library");
      state.libraryMode = "browse";
      renderCreatePlan();
      showToast("已添加到草稿");
      return;
    }
    if (state.editingPlanId) {
      P.addExercise(state.editingPlanId, exerciseId, pe);
      closeSubpage("subpage-library");
      state.libraryMode = "browse";
      openPlanDetail(state.editingPlanId);
      showToast("已添加到计划");
      return;
    }
    showToast("请先打开计划编辑");
  }

  function openExerciseDetail(id) {
    const master = LiftOS.getExercise(id);
    if (!master) return;
    $("#exDetailTitle").textContent = master.name;
    const rows = St.exerciseHistory(id);
    const best = St.bestSet(id);
    const bestE = St.bestE1RM(id);
    const series = St.e1rmSeries(id, [], "all");
    const showE1 = master.supportsE1RM !== false;

    const chart =
      series.length >= 2
        ? (() => {
            const vals = series.map((s) => s.value);
            const max = Math.max(...vals);
            const min = Math.min(...vals);
            const pts = series
              .map((s, i) => {
                const x = 20 + (i / (series.length - 1)) * 300;
                const y = 130 - ((s.value - min) / Math.max(max - min, 1)) * 100;
                return `${x},${y}`;
              })
              .join(" ");
            return `<svg class="chart-svg" viewBox="0 0 340 160" aria-label="趋势图">
              <line class="grid-line" x1="20" y1="30" x2="320" y2="30"/>
              <line class="grid-line" x1="20" y1="80" x2="320" y2="80"/>
              <line class="grid-line" x1="20" y1="130" x2="320" y2="130"/>
              <polyline class="line" points="${pts}" fill="none"/>
            </svg>`;
          })()
        : `<p class="text-secondary" style="font-size:13px">数据不足，完成更多训练后显示趋势。</p>`;

    $("#exDetailBody").innerHTML = `
      <div class="content">
        <div class="metric-row mb-4">
          <div class="metric-card"><div class="label">当前最佳</div><div class="value" style="font-size:18px">${best ? `${best.weight}×${best.reps}` : "—"}</div></div>
          <div class="metric-card"><div class="label">${showE1 ? "预计 1RM" : "主指标"}</div><div class="value" style="font-size:18px">${showE1 && bestE ? bestE.e1rm.toFixed(1) + " kg" : best ? best.weight + " kg" : "—"}</div></div>
          <div class="metric-card"><div class="label">训练次数</div><div class="value" style="font-size:18px">${rows.length}</div></div>
          <div class="metric-card"><div class="label">动作类型</div><div class="value" style="font-size:16px">${master.category === "compound" ? "复合" : "孤立"}</div></div>
        </div>
        <div class="chart-box">
          <div class="chart-title">${showE1 ? "力量趋势 e1RM" : "重量趋势"}</div>
          <div class="chart-sub">${master.muscleLabel} · ${LiftOS.EquipLabels[master.equipment] || ""}</div>
          ${chart}
        </div>
        <div class="section">
          <div class="section-title">${showE1 ? "复合指标" : "孤立动作指标"}</div>
          <div class="card" style="font-size:14px;line-height:1.7;color:var(--text-secondary)">
            ${showE1 ? "突出 e1RM / 重量 / PR（Epley，1–12次为主）" : "突出重量、次数与单次容量，不强调 1RM"}
          </div>
        </div>
        <div class="section">
          <div class="section-title">训练历史</div>
          <div class="card">
            ${
              rows.length
                ? rows
                    .map(
                      (r) => `<div class="history-session">
                        <div class="date">${esc(r.date)} · ${esc(r.planName || "")}</div>
                        ${r.sets.map((s) => `<div class="set-line">${s.weight}kg × ${s.reps}${s.rir != null ? ` · RIR ${s.rir}` : ""}</div>`).join("")}
                      </div>`
                    )
                    .join("")
                : `<p class="text-secondary" style="font-size:13px">还没有训练数据</p>`
            }
          </div>
        </div>
      </div>`;
    openSubpage("subpage-ex-detail");
  }

  /* ---------- DATA ---------- */
  function renderData() {
    const range = state.dataRange;
    const sum = St.summarizeHistory(range);
    $("#dataSessions").textContent = sum.sessions;
    $("#dataHours").textContent = `${Math.floor(sum.minutes / 60)}h`;
    $("#dataMinutes").textContent = `${sum.minutes % 60}m`;
    $("#dataVolume").textContent = sum.volume >= 1000 ? `${Math.round(sum.volume / 1000)}k` : String(sum.volume);
    $("#dataVolumeUnit").textContent = "kg";
    $("#dataPrs").textContent = sum.prs;

    // strength rows for compounds
    const lifts = [
      { id: "bench", label: "卧推" },
      { id: "squat", label: "深蹲" },
      { id: "hack_squat", label: "哈克" },
    ];
    $("#strengthRows").innerHTML = lifts
      .map((l) => {
        const series = St.e1rmSeries(l.id, [], range);
        if (series.length < 1) {
          return `<div class="strength-row"><span class="lift-name">${l.label}</span><span class="arrow-path">暂无数据</span></div>`;
        }
        const first = series[0].value;
        const last = series[series.length - 1].value;
        return `<div class="strength-row">
          <span class="lift-name">${l.label}</span>
          <span class="arrow-path">${Math.round(first)} <span>→</span> <strong>${Math.round(last)}</strong> kg</span>
        </div>`;
      })
      .join("");

    // e1rm chart for squat or hack
    const chartId = sum.byExercise.hack_squat ? "hack_squat" : "bench";
    const series = St.e1rmSeries(chartId, [], range);
    const name = LiftOS.getExercise(chartId)?.name || "趋势";
    $("#dataChartTitle").textContent = `${name} e1RM`;
    $("#dataChartSub").textContent =
      series.length >= 2
        ? `${Math.round(series[0].value)} → ${Math.round(series[series.length - 1].value)} kg`
        : "数据不足";
    if (series.length >= 2) {
      const vals = series.map((s) => s.value);
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      const pts = series
        .map((s, i) => {
          const x = 20 + (i / (series.length - 1)) * 300;
          const y = 130 - ((s.value - min) / Math.max(max - min, 1)) * 100;
          return `${x},${y}`;
        })
        .join(" ");
      $("#dataChartSvg").innerHTML = `
        <line class="grid-line" x1="20" y1="30" x2="320" y2="30"/>
        <line class="grid-line" x1="20" y1="80" x2="320" y2="80"/>
        <line class="grid-line" x1="20" y1="130" x2="320" y2="130"/>
        <polyline class="line" points="${pts}" fill="none"/>`;
    } else {
      $("#dataChartSvg").innerHTML = "";
    }

    const muscles = St.weeklyMuscleSets(range === "all" ? "3650d" : range === "7d" ? "7d" : range === "30d" ? "30d" : "30d");
    // for longer ranges use summarize work sets by exercise
    const muscleMap = range === "7d" || range === "30d" ? muscles : muscleMapFromSummary(sum);
    const order = ["chest", "back", "quads", "side_delts", "biceps", "triceps", "core"];
    const maxM = Math.max(1, ...Object.values(muscleMap));
    $("#dataMuscles").innerHTML = order
      .map((m) => {
        const n = muscleMap[m] || 0;
        return `<div class="muscle-row"><span class="name">${LiftOS.MuscleLabels[m] || m}</span><span class="count">${n}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / maxM) * 100)}%"></div></div></div>`;
      })
      .join("");

    // list top exercises for drill-in
    $("#dataExList").innerHTML = ["hack_squat", "incline", "bench"]
      .map((id) => {
        const m = LiftOS.getExercise(id);
        return `<div class="ex-card" onclick="App.openExerciseStats('${id}')">
          <h3>${esc(m.name)}</h3>
          <div class="muscles">${esc(m.muscleLabel)}</div>
          <div class="equip">查看趋势 →</div>
        </div>`;
      })
      .join("");
  }

  function muscleMapFromSummary(sum) {
    const map = {};
    sum.rows.forEach((h) => {
      (h.exercises || []).forEach((ex) => {
        const m = LiftOS.getExercise(ex.exerciseId);
        (m?.primaryMuscles || ["other"]).forEach((k) => {
          map[k] = (map[k] || 0) + (ex.sets || []).filter(St.isWork).length;
        });
      });
    });
    return map;
  }

  function setRange(range) {
    state.dataRange = range;
    $all(".range-tab").forEach((b) => b.classList.toggle("active", b.dataset.range === range));
    renderData();
  }

  function openExerciseStats(id) {
    openExerciseDetail(id);
  }

  /* ---------- PROFILE ---------- */
  function renderProfile() {
    const prefs = S.getPrefs();
    $("#profileName").textContent = prefs.name || "训练者";
    $("#profileGoal").textContent = `${prefs.goal || "综合"} · ${prefs.bodyWeight || "—"}kg`;
  }

  /* ---------- PLAN helpers used from HTML ---------- */
  function removePlanEx(planId, index) {
    P.removeExercise(planId, index);
    openPlanDetail(planId);
    showToast("已移除动作");
  }

  function confirmDeletePlan(planId) {
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>删除计划？</h3>
        <p>此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="btn btn-danger" onclick="App.doDeletePlan('${planId}')">删除</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
  }

  function doDeletePlan(planId) {
    P.remove(planId);
    closeOverlay();
    closeSubpage("subpage-plan");
    renderPlans();
    showToast("计划已删除");
  }

  function draftRemoveEx(i) {
    state.draftPlan.exercises.splice(i, 1);
    renderCreatePlan();
  }

  function openWeightInput(i) {
    const set = W.currentEx(state.session).sets[i];
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>输入重量</h3>
        <div class="num-input-wrap">
          <input id="modalWeight" type="number" inputmode="decimal" step="0.5" value="${set.weight ?? ""}" placeholder="kg"/>
          <span class="unit">kg</span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="App.saveModalWeight(${i})">确认</button>
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
    setTimeout(() => $("#modalWeight")?.focus(), 80);
  }

  function saveModalWeight(i) {
    const v = parseFloat($("#modalWeight").value);
    if (!Number.isNaN(v) && v >= 0) {
      W.updateSetField(state.session, i, "weight", v);
      renderSetList();
    }
    closeOverlay();
  }

  function openRepsInput(i) {
    const ex = W.currentEx(state.session);
    const set = ex.sets[i];
    const sug = set.reps == null ? pickSuggestReps(ex, set, [], i) : null;
    openOverlay(`
      <div class="modal" onclick="event.stopPropagation()">
        <h3>输入次数</h3>
        <div class="num-input-wrap">
          <input id="modalReps" type="number" inputmode="numeric" value="${set.reps ?? sug ?? ""}" placeholder="必填"/>
          <span class="unit">次</span>
        </div>
        <p class="text-secondary" style="font-size:12px">必须填写真实次数才能完成本组${sug != null ? ` · 建议 ${sug}` : ""}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="App.saveModalReps(${i})">确认</button>
          ${sug != null ? `<button class="btn btn-secondary" onclick="App.acceptSuggestReps(${i}, ${sug})">使用建议 ${sug}</button>` : ""}
          <button class="btn btn-ghost" onclick="App.closeOverlay()">取消</button>
        </div>
      </div>`);
    setTimeout(() => $("#modalReps")?.focus(), 80);
  }

  function acceptSuggestReps(i, sug) {
    W.updateSetField(state.session, i, "reps", sug);
    closeOverlay();
    renderSetList();
  }

  function saveModalReps(i) {
    const v = parseInt($("#modalReps").value, 10);
    if (!Number.isNaN(v) && v >= 0) {
      W.updateSetField(state.session, i, "reps", v);
      renderSetList();
    }
    closeOverlay();
  }

  function toggleNotes(btn) {
    btn.classList.toggle("open");
    $("#notesBody").classList.toggle("open");
  }

  function onNotesInput() {
    if (!state.session) return;
    W.setNotes(state.session, $("#notesInput").value);
  }

  function openWhySheet() {
    const ex = W.currentEx(state.session);
    openOverlay(`
      <div class="sheet" onclick="event.stopPropagation()">
        <div class="sheet-handle"></div>
        <div class="sheet-header"><h3>为什么这样建议？</h3>
          <button class="btn btn-ghost btn-sm" onclick="App.closeOverlay()">关闭</button>
        </div>
        <div class="sheet-body">
          <div class="card" style="white-space:pre-line;font-size:14px;line-height:1.6;color:var(--text-secondary)">
${esc(ex?.advice?.reason || "Double Progression：达到次数上限加重，低于下限减重或保持。")}
          </div>
          <p class="mt-3 text-secondary" style="font-size:12px;line-height:1.5">规则透明，不使用 AI。完成本组不会自动把建议次数写成真实次数。</p>
        </div>
      </div>`);
  }

  /* ---------- INIT ---------- */
  function init() {
    S.seedIfNeeded();
    const prefs = S.getPrefs();
    setTheme(prefs.theme || "dark");
    state.session = S.getSession();

    $all(".range-tab").forEach((btn) => {
      btn.addEventListener("click", () => setRange(btn.dataset.range));
    });
    $all("#goalSeg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all("#goalSeg button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    $all("#libFilters .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $all("#libFilters .filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.libMuscle = chip.dataset.muscle;
        renderLibrary();
      });
    });
    $all("#libEquipFilters .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $all("#libEquipFilters .filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.libEquip = chip.dataset.equip;
        renderLibrary();
      });
    });
    $("#libSearch")?.addEventListener("input", renderLibrary);
    $("#overlay")?.addEventListener("click", (e) => {
      if (e.target.id === "overlay") closeOverlay();
    });
    $("#notesInput")?.addEventListener("input", onNotesInput);
    $("#createPlanName")?.addEventListener("input", () => {
      state.draftPlan.name = $("#createPlanName").value;
    });

    const tick = () => {
      const now = new Date();
      $("#statusTime").textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    };
    tick();
    setInterval(tick, 30000);

    // PWA
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }

    renderHome();
    // if session exists, home already shows resume banner
  }

  return {
    init,
    nav,
    navTraining,
    setTheme,
    showToast,
    openOverlay,
    closeOverlay,
    openSubpage,
    closeSubpage,
    renderHome,
    renderPlans,
    renderCreatePlan,
    renderData,
    renderTraining,
    renderSummary,
    renderLibrary,
    startWorkoutFromPlan,
    forceStart,
    openPlanDetail,
    openCreatePlan,
    saveDraftPlan,
    draftRemoveEx,
    openDraftExEditor,
    saveDraftExEditor,
    openPlanExEditor,
    savePlanExEditor,
    removePlanEx,
    confirmDeletePlan,
    doDeletePlan,
    setLibraryMode,
    onLibraryClick,
    doAddToWorkout,
    openExerciseDetail,
    openExerciseStats,
    setRange,
    completeSet,
    requestUndo,
    doUndo,
    stepWeight,
    stepReps,
    setRir,
    focusSet,
    openWeightInput,
    saveModalWeight,
    openRepsInput,
    saveModalReps,
    acceptSuggestReps,
    nextExercise,
    skipExercise,
    addExercise,
    openReplaceSheet,
    previewReplace,
    applyReplace,
    openWorkoutProgress,
    confirmEndWorkout,
    confirmAbandon,
    abandonWorkout,
    endWorkout,
    finishSummary,
    setFeeling,
    toggleNotes,
    openWhySheet,
    adjustRest: (d) => {
      W.adjustRest(state.session, d);
      tickRest();
    },
    skipRest: () => {
      W.clearRest(state.session);
      $("#restBar").classList.remove("visible");
      renderTraining();
    },
    get state() {
      return state;
    },
  };
})();

window.App = LiftOS.UI;
document.addEventListener("DOMContentLoaded", () => App.init());
