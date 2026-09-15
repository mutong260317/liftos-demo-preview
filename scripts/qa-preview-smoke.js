/**
 * Online Preview smoke test — 393×852 against GitHub Pages.
 * Does not add product features; verification only.
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "output", "qa-preview");
const URL = "https://mutong260317.github.io/liftos-demo-preview/";

function log(step, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`);
  return { step, ok: !!ok, detail: String(detail || "") };
}

function findBrowser() {
  const c = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  const found = c.find((p) => fs.existsSync(p));
  if (found) return found;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const cache = path.join(home, ".cache", "ms-playwright");
  if (fs.existsSync(cache)) {
    for (const d of fs.readdirSync(cache).filter((x) => x.startsWith("chromium"))) {
      const bin = path.join(cache, d, "chrome-linux", "chrome");
      if (fs.existsSync(bin)) return bin;
    }
  }
  return undefined;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  const browser = await chromium.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(400);
    results.push(log("preview load", true, page.url()));
    await page.screenshot({ path: path.join(OUT, "01-home.png") });

    // home
    const homeTitle = await page.locator("#greetTitle").textContent();
    results.push(log("home opens", /准备练什么/.test(homeTitle || ""), homeTitle));
    const today = await page.locator("#todayCard").innerText();
    results.push(log("home PUSH A card", /PUSH A/.test(today) && /5\s*个动作/.test(today), today.replace(/\n/g, " ").slice(0, 80)));

    // clear storage for clean gym flow
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    // PUSH A start
    await page.getByRole("button", { name: /开始训练|进入今日计划训练/ }).click();
    await page.waitForTimeout(400);
    results.push(log("PUSH A start", /上斜哑铃卧推/.test((await page.locator("#exName").textContent()) || "")));

    // weight / reps / RIR
    await page.locator(".set-card.active .stepper-block").nth(0).locator(".stepper-btn.fast").nth(1).click();
    const w = await page.locator("#wDisplay").textContent();
    results.push(log("weight stepper", w && w !== "—", `w=${w}`));
    await page.locator(".set-card.active .stepper-block").nth(1).locator(".stepper-value").click();
    await page.waitForTimeout(200);
    await page.fill("#modalReps", "10");
    await page.getByRole("button", { name: "确认" }).click();
    await page.waitForTimeout(150);
    await page.locator(".set-card.active .rir-btn", { hasText: "2" }).first().click();
    const rirSel = await page.locator(".set-card.active .rir-btn.selected").textContent();
    results.push(log("RIR select", (rirSel || "").includes("2"), rirSel));

    // complete → rest timer
    await page.locator("#completeBtn").click();
    await page.waitForTimeout(400);
    results.push(log("rest timer after complete", (await page.locator("#restBar.visible").count()) > 0));
    results.push(log("rest time format", /\d{2}:\d{2}/.test((await page.locator("#restTime").textContent()) || "")));
    await page.screenshot({ path: path.join(OUT, "02-training-rest.png") });

    // complete remaining incline work, refresh mid-session
    await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      let idx = LiftOS.Workout.activeSetIndex(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 14, reps: 12, rir: null });
        LiftOS.Workout.clearRest(s);
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      // complete one more work set for persistence check
      if (idx >= 0) {
        LiftOS.Workout.completeSet(s, idx, { weight: 22, reps: 9, rir: 1 });
        LiftOS.Workout.clearRest(s);
      }
      App.renderTraining();
    });
    await page.waitForTimeout(200);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    results.push(log("session survives refresh", (await page.locator("#resumeBanner:not(.hide)").count()) > 0));
    await page.locator("#resumeContinue").click();
    await page.waitForTimeout(300);
    const completed = await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      return ex.sets.filter((x) => x.completed && LiftOS.Stats.isWork(x)).length;
    });
    results.push(log("continue restores sets", completed >= 1, `completedWork=${completed}`));

    // Undo
    await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      const idx = LiftOS.Workout.activeSetIndex(s);
      if (idx >= 0) {
        if (ex.sets[idx].reps == null) ex.sets[idx].reps = 8;
        LiftOS.Workout.completeSet(s, idx, { weight: ex.sets[idx].weight || 22, reps: 8, rir: 1 });
        LiftOS.Workout.clearRest(s);
        App.renderTraining();
      }
    });
    await page.waitForTimeout(150);
    const beforeUndo = await page.evaluate(() => LiftOS.Stats.workSetCount(App.state.session));
    await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      const i = ex.sets.findIndex((x) => x.completed && LiftOS.Stats.isWork(x));
      if (i >= 0) App.requestUndo(i);
    });
    await page.waitForTimeout(200);
    if ((await page.locator(".modal").count()) > 0) {
      await page.getByRole("button", { name: "撤销", exact: true }).click();
      await page.waitForTimeout(200);
    }
    const afterUndo = await page.evaluate(() => LiftOS.Stats.workSetCount(App.state.session));
    results.push(log("undo works", afterUndo === beforeUndo - 1, `${beforeUndo}->${afterUndo}`));

    // add exercise
    await page.locator("#exLoggingView .training-actions .btn-secondary", { hasText: "添加" }).click();
    await page.waitForTimeout(250);
    await page.locator(".ex-card", { hasText: "坐姿划船" }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "确认添加" }).click();
    await page.waitForTimeout(250);
    const names = await page.evaluate(() => App.state.session.exercises.map((e) => e.name));
    results.push(log("add exercise", names.includes("坐姿划船"), names.join(",")));

    // replace
    await page.evaluate(() => {
      const s = App.state.session;
      s.exIndex = 1;
      LiftOS.Workout.replaceExercise(s, "smith_bench", "default");
      App.renderTraining();
    });
    await page.waitForTimeout(200);
    const replaced = await page.evaluate(() => LiftOS.Workout.currentEx(App.state.session).name);
    results.push(log("replace exercise", /史密斯/.test(replaced), replaced));

    // notes persist
    await page.locator(".notes-toggle").click();
    await page.fill("#notesInput", "线上笔记测试 扁平凳");
    await page.waitForTimeout(100);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    await page.locator("#resumeContinue").click();
    await page.waitForTimeout(250);
    // go to an exercise that had notes - set note on current then reload
    const noteVal = await page.evaluate(() => LiftOS.Workout.currentEx(App.state.session).notes || "");
    // write note for this ex and verify storage key
    await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      LiftOS.Workout.setNotes(App.state.session, "线上笔记测试 扁平凳");
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    const storedNote = await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      return LiftOS.Storage.getNote(ex.exerciseId);
    });
    results.push(log("notes persist after refresh", /线上笔记/.test(storedNote || ""), storedNote));

    // bodyweight: finish current path to PULL A or start PULL A after abandon
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      const plan = LiftOS.Plans.get("pullA");
      const s = LiftOS.Workout.createFromPlan(plan);
      LiftOS.Storage.saveSession(s);
      App.state.session = s;
      App.navTraining();
    });
    await page.waitForTimeout(250);
    const bwW = await page.evaluate(() => LiftOS.Workout.currentEx(App.state.session).sets.find((x) => x.type === "work").weight);
    await page.evaluate(() => {
      const s = App.state.session;
      const idx = LiftOS.Workout.activeSetIndex(s);
      LiftOS.Workout.completeSet(s, idx, { weight: 0, reps: 8, rir: 1 });
      LiftOS.Workout.clearRest(s);
    });
    const bwDone = await page.evaluate(() => LiftOS.Workout.currentEx(App.state.session).sets.some((x) => x.completed));
    results.push(log("bodyweight PULL A pullup", bwW === 0 && bwDone, `weight=${bwW} done=${bwDone}`));

    // LEGS start
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      App.nav("plans");
    });
    await page.waitForTimeout(200);
    await page.locator(".plan-card", { hasText: "LEGS" }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "用此计划开始" }).click();
    await page.waitForTimeout(300);
    const legs = await page.evaluate(() => ({ plan: App.state.session.planName, ex: LiftOS.Workout.currentEx(App.state.session).name }));
    results.push(log("LEGS start", legs.plan === "LEGS" && /哈克/.test(legs.ex), JSON.stringify(legs)));

    // finish a small session → history
    await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      let idx = LiftOS.Workout.activeSetIndex(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 40, reps: 12, rir: null });
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      LiftOS.Workout.completeSet(s, idx, { weight: 105, reps: 10, rir: 1 });
      LiftOS.Workout.clearRest(s);
      s.exIndex = s.exercises.length - 1;
      // complete last ex one set so summary has work
      const last = LiftOS.Workout.currentEx(s);
      const li = LiftOS.Workout.activeSetIndex(s);
      if (li >= 0) {
        if (last.sets[li].reps == null) last.sets[li].reps = 15;
        LiftOS.Workout.completeSet(s, li, { weight: last.sets[li].weight || 0, reps: 15, rir: 1 });
        LiftOS.Workout.clearRest(s);
      }
      App.renderTraining();
      App.endWorkout();
    });
    await page.waitForTimeout(300);
    const sumSets = await page.locator("#sumSets").textContent();
    results.push(log("summary real sets", Number(sumSets) > 0, sumSets));
    await page.getByRole("button", { name: "完成并保存" }).click();
    await page.waitForTimeout(250);
    const histLen = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    results.push(log("history saved", histLen >= 14, `len=${histLen}`));

    // create plan + edit params
    await page.evaluate(() => App.nav("plans"));
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "+ 新建" }).click();
    await page.waitForTimeout(200);
    await page.fill("#createPlanName", "PREVIEW PLAN");
    await page.evaluate(() => App.setLibraryMode("addToPlan"));
    await page.waitForTimeout(200);
    await page.locator(".ex-card", { hasText: "哑铃侧平举" }).first().click();
    await page.waitForTimeout(200);
    const draft = await page.evaluate(() => App.state.draftPlan.exercises[0]);
    results.push(log("draft uses defaultParams", draft && draft.repMin === 12 && draft.restSeconds === 60, JSON.stringify(draft)));
    await page.getByRole("button", { name: "保存计划" }).click();
    await page.waitForTimeout(300);
    const hasPlan = await page.evaluate(() => LiftOS.Plans.all().some((p) => p.name === "PREVIEW PLAN"));
    results.push(log("new plan saved", hasPlan));
    await page.locator("#planDetailBody .plan-day-item .info").first().click();
    await page.waitForTimeout(200);
    await page.fill("#peSets", "5");
    await page.getByRole("button", { name: "保存参数" }).click();
    await page.waitForTimeout(200);
    const pe = await page.evaluate(() => LiftOS.Plans.all().find((p) => p.name === "PREVIEW PLAN").exercises[0]);
    results.push(log("plan param edit", pe.workSets === 5, JSON.stringify(pe.workSets)));

    // dashboard range
    await page.evaluate(() => App.nav("data"));
    await page.waitForTimeout(200);
    await page.locator('.range-tab[data-range="7d"]').click();
    await page.waitForTimeout(150);
    const s7 = await page.locator("#dataSessions").innerText();
    await page.locator('.range-tab[data-range="all"]').click();
    await page.waitForTimeout(150);
    const sAll = await page.locator("#dataSessions").innerText();
    results.push(log("dashboard range filter", Number(sAll) >= Number(s7) && s7 !== "", `7d=${s7} all=${sAll}`));

    // PWA assets from live origin
    const manifestOk = await page.evaluate(async () => {
      const r = await fetch("manifest.json");
      if (!r.ok) return false;
      const j = await r.json();
      return !!j.name && !!j.icons?.length;
    });
    results.push(log("PWA manifest live", manifestOk));
    const swReg = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "unsupported";
      try {
        const reg = await navigator.serviceWorker.register("sw.js");
        return !!reg;
      } catch (e) {
        return "err:" + e.message;
      }
    });
    results.push(log("PWA service worker register", swReg === true || swReg === "unsupported", String(swReg)));

    // local QA suites against preview URL by pointing INDEX — run quick core asserts only
    results.push(log("no maximum-scale", !(await page.content()).includes("maximum-scale")));

    await page.screenshot({ path: path.join(OUT, "final.png") });
  } catch (err) {
    results.push(log("suite error", false, err.message || String(err)));
    try {
      await page.screenshot({ path: path.join(OUT, "error.png") });
    } catch {}
  }

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n== PREVIEW SMOKE ${pass}/${results.length} passed, ${fail} failed ==`);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ pass, fail, results }, null, 2));
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
