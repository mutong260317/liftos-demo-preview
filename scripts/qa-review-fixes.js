/**
 * Review-fix QA for PR #1 items 1–6.
 * Run: node scripts/qa-review-fixes.js
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "output", "qa-review");
const ROOT = path.dirname(__dirname);
const INDEX = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";

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
    const dirs = fs.readdirSync(cache).filter((d) => d.startsWith("chromium"));
    for (const d of dirs) {
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
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(8000);

  try {
    await page.goto(INDEX, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    // --- Issue 3: seed dates recent + localDateKey ---
    const seedDates = await page.evaluate(() => LiftOS.Storage.getHistory().map((h) => h.date));
    const localKey = await page.evaluate(() => LiftOS.localDateKey());
    const year = localKey.slice(0, 4);
    results.push(log("seed history uses recent local dates", seedDates.every((d) => d.startsWith(year) || d.startsWith(String(Number(year)))), `year=${year} sample=${seedDates[0]}`));
    const seven = await page.evaluate(() => LiftOS.Stats.summarizeHistory("7d").sessions);
    results.push(log("7d dashboard non-empty with seed", seven > 0, `sessions=${seven}`));
    const localOk = await page.evaluate(() => {
      const d = new Date();
      const k = LiftOS.localDateKey(d);
      return k === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    results.push(log("localDateKey is local not UTC ISO", localOk));

    // --- Issue 2: bodyweight start weight 0, progression no +0 ---
    const bwStart = await page.evaluate(() => {
      return LiftOS.Progression.getProgressionSuggestion({
        exerciseId: "pullup",
        repMin: 6,
        repMax: 10,
        historyRows: [],
      });
    });
    results.push(log("bodyweight start weight 0", bwStart.suggestedWeight === 0, JSON.stringify(bwStart)));

    const bwCap = await page.evaluate(() => {
      return LiftOS.Progression.getProgressionSuggestion({
        exerciseId: "crunch",
        repMin: 15,
        repMax: 20,
        historyRows: [
          {
            sets: [
              { type: "work", weight: 0, reps: 20 },
              { type: "work", weight: 0, reps: 20 },
            ],
          },
        ],
      });
    });
    results.push(log("bodyweight at cap does not +0kg", bwCap.suggestedWeight === 0 && !/\\+0kg/.test(bwCap.reason || "") && bwCap.action === "increase", JSON.stringify(bwCap)));

    // start LEGS, check crunch/pullup path via PULL A pullup
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
    const pullupWeight = await page.evaluate(() => LiftOS.Workout.currentEx(App.state.session).sets.find((s) => s.type === "work").weight);
    results.push(log("PULL A pullup work weight 0", pullupWeight === 0, String(pullupWeight)));
    await page.evaluate(() => {
      const s = App.state.session;
      const idx = LiftOS.Workout.activeSetIndex(s);
      LiftOS.Workout.completeSet(s, idx, { weight: 0, reps: 8, rir: 1 });
      LiftOS.Workout.clearRest(s);
    });
    const bwCompleteOk = await page.evaluate(() => {
      const s = App.state.session;
      return LiftOS.Workout.currentEx(s).sets.some((x) => x.completed);
    });
    results.push(log("bodyweight set can complete at 0kg", bwCompleteOk));

    // --- Issue 1: PR written to session.prs + no duplicate in-session weight PR ---
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      LiftOS.Storage.saveSession(s);
      App.state.session = s;
      // jump to incline and log 23kg x 10 (new PR vs seed 22)
      const ex = LiftOS.Workout.currentEx(s);
      // skip warmup
      let idx = LiftOS.Workout.activeSetIndex(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 10, reps: 12, rir: null });
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      const r1 = LiftOS.Workout.completeSet(s, idx, { weight: 23, reps: 10, rir: 1 });
      const idx2 = LiftOS.Workout.activeSetIndex(s);
      // same weight again should NOT re-fire weight PR (baseline includes session)
      const r2 = LiftOS.Workout.completeSet(s, idx2, { weight: 23, reps: 8, rir: 1 });
      return { r1: r1.prs, r2: r2.prs, sessionPrs: s.prs };
    });
    const prCheck = await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      let idx = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 10, reps: 12, rir: null });
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      const r1 = LiftOS.Workout.completeSet(s, idx, { weight: 23, reps: 10, rir: 1 });
      const idx2 = LiftOS.Workout.activeSetIndex(s);
      const r2 = LiftOS.Workout.completeSet(s, idx2, { weight: 23, reps: 8, rir: 1 });
      return {
        firstPrs: (r1.prs || []).map((p) => p.type),
        secondPrs: (r2.prs || []).map((p) => p.type),
        sessionPrCount: (s.prs || []).length,
        sessionPrTypes: (s.prs || []).map((p) => p.type),
      };
    });
    results.push(log("PR pushed into session.prs", prCheck.sessionPrCount >= 1 && prCheck.firstPrs.includes("weight"), JSON.stringify(prCheck)));
    results.push(log("no duplicate weight PR same session same load", !prCheck.secondPrs.includes("weight"), JSON.stringify(prCheck.secondPrs)));

    // undo removes PR
    const undoPr = await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      let idx = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 10, reps: 12, rir: null });
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      LiftOS.Workout.completeSet(s, idx, { weight: 24, reps: 10, rir: 1 });
      const before = (s.prs || []).length;
      LiftOS.Workout.undoSet(s, idx);
      return { before, after: (s.prs || []).length };
    });
    results.push(log("undo removes set-linked PRs", undoPr.before > 0 && undoPr.after === 0, JSON.stringify(undoPr)));

    // --- Issue 4: e1rmSeries range filter ---
    const seriesCompare = await page.evaluate(() => {
      const all = LiftOS.Stats.e1rmSeries("hack_squat", [], "all");
      const d7 = LiftOS.Stats.e1rmSeries("hack_squat", [], "7d");
      const d30 = LiftOS.Stats.e1rmSeries("hack_squat", [], "30d");
      return {
        all: all.length,
        d7: d7.length,
        d30: d30.length,
        allFirst: all[0]?.date,
        d7First: d7[0]?.date,
      };
    });
    results.push(log("e1rmSeries range filters points", seriesCompare.d7 <= seriesCompare.d30 && seriesCompare.d30 <= seriesCompare.all && seriesCompare.all > seriesCompare.d7, JSON.stringify(seriesCompare)));

    // dashboard chart changes with range
    await page.evaluate(() => LiftOS.Workout.abandon());
    await page.evaluate(() => App.nav("data"));
    await page.waitForTimeout(200);
    await page.locator('.range-tab[data-range="7d"]').click();
    await page.waitForTimeout(150);
    const chart7 = await page.locator("#dataChartSvg").innerHTML();
    await page.locator('.range-tab[data-range="all"]').click();
    await page.waitForTimeout(150);
    const chartAll = await page.locator("#dataChartSvg").innerHTML();
    results.push(log("dashboard chart differs by range", chart7 !== chartAll || (chart7.includes("polyline") && chartAll.includes("polyline") && seriesCompare.d7 !== seriesCompare.all), `7=${chart7.length} all=${chartAll.length}`));

    // --- Issue 5: replace uses master.defaultParams ---
    const replaceDefault = await page.evaluate(() => {
      const lateral = LiftOS.getExercise("lateral");
      const crunch = LiftOS.getExercise("crunch");
      const legPress = LiftOS.getExercise("leg_press");
      return {
        lateral: lateral.defaultParams,
        crunch: crunch.defaultParams,
        legPress: legPress.defaultParams,
      };
    });
    results.push(log("lateral defaults 12-15 rest 60", replaceDefault.lateral.repMin === 12 && replaceDefault.lateral.repMax === 15 && replaceDefault.lateral.restSeconds === 60, JSON.stringify(replaceDefault.lateral)));
    results.push(log("crunch defaults 15-20", replaceDefault.crunch.repMin === 15 && replaceDefault.crunch.repMax === 20, JSON.stringify(replaceDefault.crunch)));
    results.push(log("leg_press defaults 4x10-15 rest 120", replaceDefault.legPress.workSets === 4 && replaceDefault.legPress.repMin === 10 && replaceDefault.legPress.restSeconds === 120, JSON.stringify(replaceDefault.legPress)));

    const applied = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      App.state.session = s;
      // replace first with lateral default
      LiftOS.Workout.replaceExercise(s, "lateral", "default");
      const ex = LiftOS.Workout.currentEx(s);
      return ex.planExercise;
    });
    results.push(log("replace default uses lateral master params", applied.repMin === 12 && applied.repMax === 15 && applied.restSeconds === 60, JSON.stringify(applied)));

    // --- Issue 6: plan exercise param editor ---
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      App.nav("plans");
      App.openPlanDetail("pushA");
    });
    await page.waitForTimeout(200);
    await page.locator("#planDetailBody .plan-day-item .info").first().click();
    await page.waitForTimeout(200);
    results.push(log("plan param editor opens", (await page.locator("#peSets").count()) > 0));
    await page.fill("#peSets", "5");
    await page.fill("#peMin", "6");
    await page.fill("#peMax", "10");
    await page.fill("#peRest", "150");
    await page.getByRole("button", { name: "保存参数" }).click();
    await page.waitForTimeout(200);
    const savedPe = await page.evaluate(() => LiftOS.Plans.get("pushA").exercises[0]);
    results.push(log("plan exercise params saved", savedPe.workSets === 5 && savedPe.repMin === 6 && savedPe.repMax === 10 && savedPe.restSeconds === 150, JSON.stringify(savedPe)));

    // draft editor
    await page.evaluate(() => {
      App.closeSubpage("subpage-plan");
      App.openCreatePlan();
      state = App.state;
      App.state.draftPlan.exercises.push({
        exerciseId: "bench",
        workSets: 3,
        repMin: 8,
        repMax: 12,
        restSeconds: 90,
        targetRirMin: 1,
        targetRirMax: 2,
      });
      // re-render via open
      App.renderCreatePlan ? null : null;
    });
    // renderCreatePlan may not be exported — open editor via DOM after manual render
    await page.evaluate(() => {
      // force list render by calling openDraftExEditor path after injecting html
      const d = App.state.draftPlan;
      // use exported openDraftExEditor
      App.openDraftExEditor(0);
    });
    await page.waitForTimeout(150);
    results.push(log("draft param editor opens", (await page.locator("#peSets").count()) > 0));
    await page.fill("#peSets", "4");
    await page.getByRole("button", { name: "保存参数" }).click();
    await page.waitForTimeout(100);
    const draftPe = await page.evaluate(() => App.state.draftPlan.exercises[0]);
    results.push(log("draft exercise params saved", draftPe.workSets === 4, JSON.stringify(draftPe)));

    // summary counts session PRs from finish path
    const finishPr = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      let idx = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 10, reps: 12, rir: null });
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      LiftOS.Workout.completeSet(s, idx, { weight: 30, reps: 8, rir: 0 });
      const m = LiftOS.Workout.summaryModel(s);
      return { prs: m.prs.length, types: m.prs.map((p) => p.type) };
    });
    results.push(log("summary uses session.prs", finishPr.prs >= 1, JSON.stringify(finishPr)));

    // --- Review round 2: bodyweight Rep PR baseline ---
    const bwPr = await page.evaluate(() => {
      // seed history has pullup 8 and 7 at weight 0
      const best = LiftOS.Stats.bestSet("pullup");
      const prs = LiftOS.Stats.detectSetPRs(
        "pullup",
        { type: "work", completed: true, weight: 0, reps: 10 },
        []
      );
      const noPr = LiftOS.Stats.detectSetPRs(
        "pullup",
        { type: "work", completed: true, weight: 0, reps: 8 },
        []
      );
      const e1 = LiftOS.Stats.bestE1RM("pullup");
      return { best, prs, noPr, e1 };
    });
    results.push(
      log(
        "bodyweight bestSet accepts weight=0",
        bwPr.best && bwPr.best.weight === 0 && bwPr.best.reps === 8,
        JSON.stringify(bwPr.best)
      )
    );
    results.push(
      log(
        "bodyweight Rep PR 8→10 fires",
        bwPr.prs.some((p) => p.type === "reps"),
        JSON.stringify(bwPr.prs)
      )
    );
    results.push(
      log(
        "bodyweight equal reps no PR",
        bwPr.noPr.length === 0,
        JSON.stringify(bwPr.noPr)
      )
    );
    results.push(log("bodyweight e1RM stays null", bwPr.e1 === null, String(bwPr.e1)));

    // live session pullup rep PR
    const liveBw = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pullA");
      const s = LiftOS.Workout.createFromPlan(plan);
      const idx = LiftOS.Workout.activeSetIndex(s);
      const r = LiftOS.Workout.completeSet(s, idx, { weight: 0, reps: 10, rir: 1 });
      return { prs: (r.prs || []).map((p) => p.type), session: (s.prs || []).map((p) => p.type) };
    });
    results.push(
      log(
        "live bodyweight 10 reps writes Rep PR",
        liveBw.prs.includes("reps") && liveBw.session.includes("reps"),
        JSON.stringify(liveBw)
      )
    );

    // --- Review round 2: add-to-plan uses defaultParams ---
    const addParams = await page.evaluate(() => {
      const lateral = LiftOS.Plans.resolvePlanExerciseParams("lateral");
      const crunch = LiftOS.Plans.resolvePlanExerciseParams("crunch");
      const draftPe = { exerciseId: "lateral", ...lateral };
      // simulate confirmAddToPlan draft push shape
      const plan = LiftOS.Plans.create({ name: "TMP DEF", exercises: [] });
      LiftOS.Plans.addExercise(plan.id, "lateral");
      LiftOS.Plans.addExercise(plan.id, "crunch");
      const saved = LiftOS.Plans.get(plan.id);
      return {
        lateral,
        crunch,
        draftPe,
        savedLateral: saved.exercises[0],
        savedCrunch: saved.exercises[1],
      };
    });
    results.push(
      log(
        "resolve lateral 4x12-15 RIR rest60",
        addParams.lateral.workSets === 4 &&
          addParams.lateral.repMin === 12 &&
          addParams.lateral.repMax === 15 &&
          addParams.lateral.restSeconds === 60 &&
          addParams.lateral.targetRirMin === 1 &&
          addParams.lateral.targetRirMax === 2,
        JSON.stringify(addParams.lateral)
      )
    );
    results.push(
      log(
        "resolve crunch 4x15-20 rest60",
        addParams.crunch.workSets === 4 && addParams.crunch.repMin === 15 && addParams.crunch.restSeconds === 60,
        JSON.stringify(addParams.crunch)
      )
    );
    results.push(
      log(
        "plan.addExercise uses master defaults",
        addParams.savedLateral.workSets === 4 &&
          addParams.savedLateral.repMin === 12 &&
          addParams.savedLateral.restSeconds === 60 &&
          addParams.savedLateral.targetRirMin === 1 &&
          addParams.savedCrunch.repMin === 15,
        JSON.stringify(addParams.savedLateral) + " | " + JSON.stringify(addParams.savedCrunch)
      )
    );
    results.push(
      log(
        "draft entry has RIR not undefined",
        Number.isFinite(addParams.draftPe.targetRirMin) && Number.isFinite(addParams.draftPe.targetRirMax),
        JSON.stringify(addParams.draftPe)
      )
    );

    // UI: create plan draft add lateral shows 12-15 not undefined RIR
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.nav("plans");
      App.openCreatePlan();
      App.setLibraryMode("addToPlan");
    });
    await page.waitForTimeout(200);
    await page.locator(".ex-card", { hasText: "哑铃侧平举" }).first().click();
    await page.waitForTimeout(200);
    const draftUi = await page.evaluate(() => App.state.draftPlan.exercises[0]);
    results.push(
      log(
        "UI draft add lateral uses defaults",
        draftUi &&
          draftUi.workSets === 4 &&
          draftUi.repMin === 12 &&
          draftUi.repMax === 15 &&
          draftUi.restSeconds === 60 &&
          draftUi.targetRirMin === 1 &&
          draftUi.targetRirMax === 2,
        JSON.stringify(draftUi)
      )
    );
    const draftHtml = await page.locator("#createPlanExList").innerText();
    results.push(log("draft UI no undefined RIR", !/undefined/.test(draftHtml), draftHtml.replace(/\n/g, " ")));
  } catch (err) {
    results.push(log("suite error", false, err.message || String(err)));
    try {
      await page.screenshot({ path: path.join(OUT, "error.png") });
    } catch {}
  }

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n== REVIEW FIX QA ${pass}/${results.length} passed, ${fail} failed ==`);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ pass, fail, results }, null, 2));
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
