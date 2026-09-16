/**
 * Live Preview smoke — 393×852 — V0.3.0
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const URL = "https://mutong260317.github.io/liftos-demo-preview/";
const OUT = path.join(__dirname, "output", "qa-preview-v03");

function log(step, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`);
  return { step, ok: !!ok, detail: String(detail || "") };
}

function findBrowser() {
  return [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((p) => fs.existsSync(p));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
    await page.evaluate(() => localStorage.clear());
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    results.push(log("home", /准备练什么/.test((await page.locator("#greetTitle").textContent()) || "")));
    results.push(log("APP version", (await page.evaluate(() => LiftOS.APP_VERSION)) === "0.3.1"));
    results.push(log("fresh history empty", (await page.evaluate(() => LiftOS.Storage.getHistory().length)) === 0));

    // start plan workout
    await page.getByRole("button", { name: /开始训练|进入今日计划训练/ }).click();
    await page.waitForTimeout(350);
    results.push(log("start plan workout", /上斜/.test((await page.locator("#exName").textContent()) || "")));

    // previous values shown
    results.push(log("previous values", /上次/.test(await page.locator("#setList").innerText())));

    // complete warmup + one work set, copy prev
    await page.evaluate(() => {
      const s = App.state.session;
      let idx = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 14, reps: 12, rir: null });
        LiftOS.Workout.clearRest(s);
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      LiftOS.Workout.completeSet(s, idx, { weight: 22, reps: 10, rir: 1 });
      LiftOS.Workout.clearRest(s);
      const i2 = LiftOS.Workout.activeSetIndex(s);
      const r = LiftOS.Workout.copyPreviousCompletedSet(s, i2);
      App.renderTraining();
      return r.ok;
    });
    await page.waitForTimeout(150);
    results.push(log("copy previous completed", (await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      const i = LiftOS.Workout.activeSetIndex(App.state.session);
      return ex.sets[i].reps === 10;
    })) === true));

    // copy prior workout
    results.push(log("copy prior workout API", (await page.evaluate(() => {
      const s = App.state.session;
      const i = LiftOS.Workout.activeSetIndex(s);
      return !!LiftOS.Workout.copyPriorWorkoutSet(s, i, "same_routine");
    })) === true));

    // set type
    await page.evaluate(() => {
      const s = App.state.session;
      const i = LiftOS.Workout.activeSetIndex(s);
      LiftOS.Workout.setSetType(s, i, "amrap");
    });
    results.push(log("set type amrap", (await page.evaluate(() => {
      const i = LiftOS.Workout.activeSetIndex(App.state.session);
      return LiftOS.Workout.currentEx(App.state.session).sets[i].type;
    })) === "amrap"));

    // rest timer after complete
    await page.evaluate(() => {
      const s = App.state.session;
      const i = LiftOS.Workout.activeSetIndex(s);
      const st = s.exercises[s.exIndex].sets[i];
      if (st.reps == null) st.reps = 10;
      LiftOS.Workout.completeSet(s, i, { reps: 10 });
      App.renderTraining();
    });
    await page.waitForTimeout(200);
    results.push(log("rest timer", (await page.locator("#restBar.visible").count()) > 0 || (await page.evaluate(() => !App.state.session.rest)) === false));

    // assisted pull-up
    const assist = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pullA");
      const s = LiftOS.Workout.createFromPlan(plan);
      const i = LiftOS.Workout.activeSetIndex(s);
      const r = LiftOS.Workout.completeSet(s, i, { weight: 40, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 40 });
      return { ok: r.ok, mode: r.set.loadMode, assist: r.set.assistanceKg };
    });
    results.push(log("assisted pull-up", assist.ok && assist.mode === "assisted" && assist.assist === 40, JSON.stringify(assist)));

    // duration plank
    const plank = await page.evaluate(() => {
      const s = LiftOS.Workout.createFreeSession();
      LiftOS.Workout.addExerciseToSession(s, "plank", {});
      const i = LiftOS.Workout.activeSetIndex(s);
      const r = LiftOS.Workout.completeSet(s, i, { durationSec: 60, weight: 0 });
      return { ok: r.ok, dur: r.set.durationSec };
    });
    results.push(log("duration plank 60s", plank.ok && plank.dur === 60, JSON.stringify(plank)));

    // superset cycle
    const ss = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pushA");
      LiftOS.Plans.linkPlanSuperset(plan.id, 0);
      const s = LiftOS.Workout.createFromPlan(LiftOS.Plans.get("pushA"));
      s.exercises.slice(0, 2).forEach((ex) => {
        ex.sets = ex.sets.filter((x) => x.type !== "warmup").slice(0, 2);
        LiftOS.Workout.renumberSets(ex);
      });
      s.exIndex = 0;
      function done() {
        const ex = LiftOS.Workout.currentEx(s);
        const i = LiftOS.Workout.activeSetIndex(s);
        const st = ex.sets[i];
        if (st.reps == null) st.reps = 8;
        const r = LiftOS.Workout.completeSet(s, i, { reps: 8 });
        LiftOS.Workout.clearRest(s);
        return r;
      }
      const r1 = done();
      const afterA = LiftOS.Workout.currentEx(s).name;
      const r2 = done();
      return {
        afterA,
        restAfterA: r1.restSeconds,
        restAfterB: r2.restSeconds,
        linked: !!s.exercises[0].supersetGroup,
      };
    });
    results.push(log("superset A1→B no rest", ss.linked && ss.restAfterA === 0 && /推胸|压|夹|平举/.test(ss.afterA), JSON.stringify(ss)));
    results.push(log("superset B→round rest", ss.restAfterB > 0, String(ss.restAfterB)));

    // warmup calculator
    const wu = await page.evaluate(() => LiftOS.Gym.buildWarmupPlan(100, 2.5));
    results.push(log("warmup calc", wu[0].weight === 40 && wu[2].weight === 80, JSON.stringify(wu)));

    // plate calculator
    const plate = await page.evaluate(() => LiftOS.Gym.plateLoad(102, 20));
    results.push(log("plate nearest 102.5", plate.ok && Math.abs(plate.achieved - 102.5) < 0.01, String(plate.achieved)));

    // finish one tiny session → history + summary
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      const s = LiftOS.Workout.createFromPlan(LiftOS.Plans.get("pushA"));
      let idx = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 10, reps: 12, rir: null });
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      LiftOS.Workout.completeSet(s, idx, { weight: 20, reps: 10, rir: 1 });
      LiftOS.Workout.clearRest(s);
      App.state.session = s;
      App.endWorkout();
    });
    await page.waitForTimeout(300);
    results.push(log("summary sets", Number(await page.locator("#sumSets").textContent()) > 0));
    const topHtml = await page.locator("#summaryTopEx").innerText().catch(() => "");
    results.push(log("summary top exercises", /上斜|推|夹|平举|下压/.test(topHtml) || topHtml.length > 0, topHtml.replace(/\n/g, " ").slice(0, 60)));
    const cmpHtml = await page.locator("#summaryCompare").innerText().catch(() => "");
    results.push(log("summary compare present", cmpHtml.length > 0));
    await page.getByRole("button", { name: "完成并保存" }).click();
    await page.waitForTimeout(200);

    // history correction UI
    await page.evaluate(() => App.nav("data"));
    await page.waitForTimeout(200);
    const histLen = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    results.push(log("history saved", histLen >= 1, String(histLen)));
    results.push(log("fresh has no seed ids", (await page.evaluate(() => LiftOS.Storage.getHistory().filter((h) => String(h.id).startsWith("h-")).length)) === 0));
    await page.evaluate(() => {
      const h = LiftOS.Storage.getHistory()[0];
      App.openHistoryDetail(h.id);
    });
    await page.waitForTimeout(200);
    results.push(log("history editor", (await page.locator('[data-h="r"]').count()) > 0));
    await page.evaluate(() => App.discardHistoryDraft?.() || App.closeOverlay());

    // weekly review DOM
    await page.evaluate(() => App.renderWeeklyReview());
    await page.waitForTimeout(100);
    const wr = await page.locator("#weeklyReviewCard").innerText();
    results.push(log("weekly review UI", /本周|工作组|容量/.test(wr), wr.replace(/\n/g, " ").slice(0, 60)));

    // PWA
    results.push(log("PWA manifest", (await page.evaluate(async () => {
      const r = await fetch("manifest.json");
      return r.ok;
    })) === true));
    results.push(log("SW register", (await page.evaluate(async () => {
      try {
        const reg = await navigator.serviceWorker.register("sw.js");
        return !!reg;
      } catch {
        return false;
      }
    })) === true));

    await page.screenshot({ path: path.join(OUT, "final.png") });
  } catch (err) {
    results.push(log("suite error", false, err.message || String(err)));
    try { await page.screenshot({ path: path.join(OUT, "error.png") }); } catch {}
  }

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n== PREVIEW V0.3 SMOKE ${pass}/${results.length} passed, ${fail} failed ==`);
  process.exit(fail ? 1 : 0);
})();
