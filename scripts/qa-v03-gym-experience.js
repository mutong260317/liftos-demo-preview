/**
 * V0.3 Gym Experience QA — 393×852
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "output", "qa-v03");
const ROOT = path.dirname(__dirname);
const INDEX = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const DEMO = INDEX + "?demo=1";

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
  return c.find((p) => fs.existsSync(p));
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  const browser = await chromium.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(8000);

  try {
    await page.goto(INDEX, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(DEMO, { waitUntil: "load" });
    await page.waitForTimeout(400);

    results.push(log("APP 0.3.0", (await page.evaluate(() => LiftOS.APP_VERSION)) === "0.3.0"));
    results.push(log("schema 5", (await page.evaluate(() => LiftOS.Migrations.getVersion())) === 5));

    // start PUSH A via API for control
    await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      LiftOS.Storage.saveSession(s);
      App.state.session = s;
      App.navTraining();
    });
    await page.waitForTimeout(300);

    // 1 previous values shown, not auto-filled as actual
    const setUi = await page.locator("#setList").innerText();
    results.push(log("previous values shown", /上次/.test(setUi), setUi.slice(0, 80).replace(/\n/g, " ")));
    const repsNull = await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      const i = LiftOS.Workout.activeSetIndex(App.state.session);
      return ex.sets[i].reps;
    });
    results.push(log("reps still null until user acts", repsNull === null, String(repsNull)));

    // 2 copy previous completed → editable
    await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      let idx = LiftOS.Workout.activeSetIndex(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 14, reps: 12, rir: null });
        LiftOS.Workout.clearRest(s);
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      LiftOS.Workout.completeSet(s, idx, { weight: 22, reps: 10, rir: 1 });
      LiftOS.Workout.clearRest(s);
      App.renderTraining();
    });
    await page.waitForTimeout(200);
    const copyR = await page.evaluate(() => {
      const s = App.state.session;
      const i = LiftOS.Workout.activeSetIndex(s);
      return LiftOS.Workout.copyPreviousCompletedSet(s, i);
    });
    results.push(log("copy previous completed set", copyR.ok === true && copyR.copied?.reps === 10, JSON.stringify(copyR.ok)));

    // complete copied set and reload persist
    await page.evaluate(() => {
      const s = App.state.session;
      const i = LiftOS.Workout.activeSetIndex(s);
      LiftOS.Workout.completeSet(s, i, {});
      LiftOS.Workout.clearRest(s);
      App.renderTraining();
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(300);
    await page.locator("#resumeContinue").click();
    await page.waitForTimeout(200);
    const persisted = await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      return ex.sets.filter((s) => s.completed && LiftOS.Stats.isWork(s)).length;
    });
    results.push(log("copy+complete persists after reload", persisted >= 2, `n=${persisted}`));

    // 3 add/delete set
    const addDel = await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      const before = ex.sets.length;
      LiftOS.Workout.addSet(s, null, "work");
      const mid = LiftOS.Workout.currentEx(s).sets.length;
      const i = LiftOS.Workout.activeSetIndex(s);
      LiftOS.Workout.deleteSet(s, i);
      const after = LiftOS.Workout.currentEx(s).sets.length;
      return { before, mid, after };
    });
    results.push(log("add then delete set", addDel.mid === addDel.before + 1 && addDel.after === addDel.before, JSON.stringify(addDel)));

    // 4 warmup excluded from work count
    const wc = await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      const work = LiftOS.Workout.workSetsOf(ex).length;
      const all = ex.sets.length;
      return { work, all, warm: all - work };
    });
    results.push(log("warmup excluded from workSets", wc.warm >= 1 && wc.work < wc.all, JSON.stringify(wc)));

    // 5 set type amrap/drop/failure
    await page.evaluate(() => {
      const s = App.state.session;
      const i = LiftOS.Workout.activeSetIndex(s);
      LiftOS.Workout.setSetType(s, i, "amrap");
      LiftOS.Workout.completeSet(s, i, { weight: 20, reps: 15, rir: 0, type: "amrap" });
      LiftOS.Workout.clearRest(s);
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(250);
    const amrap = await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      return ex.sets.some((s) => s.type === "amrap" && s.completed);
    });
    results.push(log("amrap set survives reload", amrap === true));

    // 6 assisted PR less assistance better
    const assist = await page.evaluate(() => {
      // seed history assisted 40kg x8
      const hist = LiftOS.Storage.getHistory();
      hist.unshift({
        id: "ws_assist_seed",
        date: LiftOS.localDateKey(),
        planName: "PULL A",
        volume: 320,
        workSets: 1,
        exercises: [
          {
            exerciseId: "pullup",
            name: "引体向上",
            sets: [{ type: "work", weight: 40, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 40 }],
          },
        ],
      });
      LiftOS.Storage.saveHistory(hist);
      const plan = LiftOS.Plans.get("pullA");
      const s = LiftOS.Workout.createFromPlan(plan);
      const idx = LiftOS.Workout.activeSetIndex(s);
      const r = LiftOS.Workout.completeSet(s, idx, { weight: 35, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 35 });
      return { prs: (r.prs || []).map((p) => p.type), detail: r.prs?.[0]?.detail };
    });
    results.push(log("assisted 35kg better than 40kg", assist.prs.includes("assisted") || assist.prs.includes("reps") || assist.detail?.includes("35"), JSON.stringify(assist)));

    // 7 pure pullup weight 0 rep PR
    const pure = await page.evaluate(() => {
      const s = App.state.session;
      // current is pullup from pullA start? we created pullA above inside assist - use new
      const plan = LiftOS.Plans.get("pullA");
      const s2 = LiftOS.Workout.createFromPlan(plan);
      const idx = LiftOS.Workout.activeSetIndex(s2);
      const r = LiftOS.Workout.completeSet(s2, idx, { weight: 0, reps: 12, rir: 1, loadMode: "bodyweight" });
      return { ok: r.ok, reps: r.set?.reps };
    });
    results.push(log("pure pullup 0kg complete", pure.ok === true && pure.reps === 12, JSON.stringify(pure)));

    // 8 duration plank 60s no reps
    const plank = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("legs");
      const s = LiftOS.Workout.createFromPlan(plan);
      // jump to crunch/plank — crunch is BW reps; use gym helper on plank by adding
      LiftOS.Workout.addExerciseToSession(s, "plank", {});
      s.exIndex = s.exercises.length - 1;
      const i = LiftOS.Workout.activeSetIndex(s);
      const r = LiftOS.Workout.completeSet(s, i, { durationSec: 60, weight: 0 });
      return { ok: r.ok, dur: r.set?.durationSec, reps: r.set?.reps };
    });
    results.push(log("plank duration 60s no reps required", plank.ok === true && plank.dur === 60, JSON.stringify(plank)));

    // 9 rest +15 / skip; last set no rest
    const restInfo = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      const ex = LiftOS.Workout.currentEx(s);
      // complete all but check last work set result.skippedRest
      let last;
      let idx = LiftOS.Workout.activeSetIndex(s);
      while (idx >= 0) {
        const set = ex.sets[idx];
        if (set.reps == null) set.reps = 8;
        last = LiftOS.Workout.completeSet(s, idx, { weight: set.weight || 20, reps: set.reps, rir: 1 });
        LiftOS.Workout.clearRest(s);
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      return { skippedRest: last?.skippedRest, rest: last?.restSeconds };
    });
    results.push(log("final set skips rest", restInfo.skippedRest === true, JSON.stringify(restInfo)));

    // 10 refresh keeps state — already covered above
    results.push(log("refresh keeps workout", (await page.evaluate(() => !!LiftOS.Storage.getSession())) === true || persisted >= 2));

    // 11 free workout
    const free = await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      const s = LiftOS.Workout.createFreeSession();
      LiftOS.Storage.saveSession(s);
      LiftOS.Workout.addExerciseToSession(s, "incline", {});
      const i = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      if (ex.sets[i].reps == null) ex.sets[i].reps = 10;
      LiftOS.Workout.completeSet(s, i, { weight: 20, reps: 10, rir: 1 });
      const entry = LiftOS.Workout.finish(s, {});
      return { source: entry.source, planId: entry.planId, has: LiftOS.Storage.getHistory().some((h) => h.id === entry.id) };
    });
    results.push(log("free workout → history", free.planId === null && free.source === "free" && free.has, JSON.stringify(free)));

    // 12 history correction
    const corr = await page.evaluate(() => {
      const hist = LiftOS.Storage.getHistory();
      const entry = JSON.parse(JSON.stringify(hist[0]));
      const ex0 = entry.exercises[0];
      ex0.sets[0].reps = (ex0.sets[0].reps || 8) + 2;
      const beforeLen = hist.length;
      LiftOS.Workout.updateHistoryEntry(entry);
      const after = LiftOS.Storage.getHistory();
      return { beforeLen, afterLen: after.length, newReps: after.find((h) => h.id === entry.id)?.exercises?.[0]?.sets?.[0]?.reps };
    });
    results.push(log("history correction no duplicate", corr.beforeLen === corr.afterLen && corr.newReps != null, JSON.stringify(corr)));

    // 13 warmup calculator rounding
    const wu = await page.evaluate(() => LiftOS.Gym.buildWarmupPlan(100, 2.5));
    results.push(
      log(
        "warmup calc rounds",
        wu.length === 3 && wu[0].weight === 40 && wu[1].weight === 60 && wu[2].weight === 80,
        JSON.stringify(wu)
      )
    );

    // 14 plate calculator
    const plate = await page.evaluate(() => {
      const ok = LiftOS.Gym.plateLoad(100, 20);
      const bad = LiftOS.Gym.plateLoad(10, 20);
      return { ok, bad };
    });
    results.push(
      log(
        "plate calc 100kg = 40/side",
        plate.ok.ok && plate.ok.exact && plate.ok.perSide.reduce((a, b) => a + b, 0) === 40,
        JSON.stringify(plate.ok.perSide)
      )
    );
    results.push(log("plate calc rejects under bar", plate.bad.ok === false));

    // 18 production history empty without demo
    await page.goto(INDEX, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const prod = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    results.push(log("production history empty", prod === 0, String(prod)));

    // 19 mobile smoke home
    results.push(log("home loads", (await page.locator("#todayCard").count()) > 0));
    results.push(log("free workout button", (await page.getByRole("button", { name: "开始自由训练" }).count()) > 0));

    /* ===== Review Round 1 P0 fixes ===== */

    // Plate nearest 102kg / 20 bar → 102.5 closer than 100
    const plateNear = await page.evaluate(() => LiftOS.Gym.plateLoad(102, 20));
    results.push(
      log(
        "plate nearest 102→102.5",
        plateNear.ok && Math.abs(plateNear.achieved - 102.5) < 0.01,
        JSON.stringify(plateNear)
      )
    );

    // P0-1 legacy migration: pullup weight=10 → added_weight
    const legacyMig = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "4");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_legacy_bw",
            date: LiftOS.localDateKey(),
            planName: "PULL A",
            volume: 80,
            workSets: 1,
            exercises: [
              { exerciseId: "pullup", name: "引体向上", sets: [{ type: "work", weight: 10, reps: 8, rir: 1 }] },
              { exerciseId: "plank", name: "平板支撑", sets: [{ type: "work", weight: 0, reps: 60, rir: null }] },
            ],
          },
          {
            id: "ws_legacy_bw0",
            date: LiftOS.localDateKey(),
            planName: "PULL A",
            volume: 0,
            workSets: 1,
            exercises: [{ exerciseId: "pullup", name: "引体向上", sets: [{ type: "work", weight: 0, reps: 8, rir: 1 }] }],
          },
        ])
      );
      localStorage.setItem(
        "liftos.session",
        JSON.stringify({
          id: "ws_act",
          planId: "pullA",
          planName: "PULL A",
          startTime: Date.now(),
          exIndex: 0,
          exercises: [{ exerciseId: "pullup", name: "引体向上", sets: [{ id: "s1", type: "work", weight: 10, reps: null, rir: null, completed: false }], skipped: false }],
          prs: [],
          version: 2,
        })
      );
      LiftOS.Migrations.run();
      const hist = JSON.parse(localStorage.getItem("liftos.history"));
      const sess = JSON.parse(localStorage.getItem("liftos.session"));
      const h0 = hist.find((h) => h.id === "ws_legacy_bw").exercises[0].sets[0];
      const h1 = hist.find((h) => h.id === "ws_legacy_bw0").exercises[0].sets[0];
      const pl = hist.find((h) => h.id === "ws_legacy_bw").exercises[1].sets[0];
      return {
        added: h0.loadMode,
        addedKg: h0.addedWeightKg,
        bw0: h1.loadMode,
        sessMode: sess.exercises[0].sets[0].loadMode,
        plank: pl.loadMode,
        schema: localStorage.getItem("liftos.schemaVersion"),
      };
    });
    results.push(
      log(
        "legacy pullup +10 → added_weight",
        legacyMig.added === "added_weight" && legacyMig.addedKg === 10 && legacyMig.sessMode === "added_weight",
        JSON.stringify(legacyMig)
      )
    );
    results.push(log("legacy pullup 0 → bodyweight", legacyMig.bw0 === "bodyweight", legacyMig.bw0));

    // P0-2 dynamic add pullup mode; assisted baseline once; volume not assistance
    const loadModes = await page.evaluate(() => {
      localStorage.clear();
      // fresh + seed assist history 40x8
      localStorage.setItem("liftos.schemaVersion", "5");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_a40",
            date: LiftOS.localDateKey(),
            planName: "P",
            volume: 0,
            workSets: 1,
            exercises: [
              {
                exerciseId: "pullup",
                name: "引体",
                sets: [{ type: "work", weight: 40, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 40 }],
              },
            ],
          },
        ])
      );
      LiftOS.Storage.ensureDefaults();
      const plan = LiftOS.Plans.get("pullA");
      const s = LiftOS.Workout.createFromPlan(plan);
      const mode0 = LiftOS.Workout.currentEx(s).sets.find((x) => x.type === "work").loadMode;
      // two assisted sets same session
      const i0 = LiftOS.Workout.activeSetIndex(s);
      const r1 = LiftOS.Workout.completeSet(s, i0, { weight: 35, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 35 });
      LiftOS.Workout.clearRest(s);
      const i1 = LiftOS.Workout.activeSetIndex(s);
      const r2 = LiftOS.Workout.completeSet(s, i1, { weight: 35, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 35 });
      LiftOS.Workout.clearRest(s);
      const i2 = LiftOS.Workout.activeSetIndex(s);
      const r3 = LiftOS.Workout.completeSet(s, i2, { weight: 35, reps: 6, rir: 1, loadMode: "assisted", assistanceKg: 35 });
      LiftOS.Workout.clearRest(s);
      const vol = LiftOS.Stats.sessionVolume(s);
      const best = LiftOS.Stats.bestSet("pullup");
      return {
        mode0,
        pr1: (r1.prs || []).map((p) => p.label),
        pr2: (r2.prs || []).map((p) => p.label),
        pr3: (r3.prs || []).map((p) => p.label),
        prs: s.prs.map((p) => p.label),
        vol,
        best,
      };
    });
    results.push(log("added/replaced pullup bodyweight mode", loadModes.mode0 === "bodyweight", loadModes.mode0));
    results.push(
      log(
        "assist 35x8 improves vs 40x8",
        loadModes.pr1.includes("New Assist PR") || loadModes.prs.includes("New Assist PR"),
        JSON.stringify(loadModes.pr1)
      )
    );
    results.push(
      log(
        "second same-session assist no repeated baseline/PR",
        !(loadModes.pr2 || []).includes("Assist Baseline") && !(loadModes.pr2 || []).includes("New Assist PR"),
        JSON.stringify(loadModes.pr2)
      )
    );
    results.push(
      log(
        "35x6 does not beat 35x8",
        !(loadModes.pr3 || []).includes("New Assist PR"),
        JSON.stringify(loadModes.pr3)
      )
    );
    results.push(log("assisted volume excluded from tonnage", loadModes.vol === 0, String(loadModes.vol)));
    results.push(log("bestSet ignores assisted", !loadModes.best || loadModes.best.loadMode !== "assisted", JSON.stringify(loadModes.best)));

    // P0-3 delete completed PR-bearing set recalcs later PR
    const delPr = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      // history best incline 20x10
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_base_in",
            date: LiftOS.localDateKey(),
            planName: "PUSH A",
            volume: 600,
            workSets: 3,
            exercises: [
              { exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 20, reps: 10, rir: 1 }] },
            ],
          },
        ])
      );
      LiftOS.Storage.ensureDefaults();
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      let idx = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 10, reps: 12, rir: null });
        LiftOS.Workout.clearRest(s);
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      // set1 23x10 = weight PR; set2 23x9 no PR
      LiftOS.Workout.completeSet(s, idx, { weight: 23, reps: 10, rir: 1 });
      LiftOS.Workout.clearRest(s);
      const idx2 = LiftOS.Workout.activeSetIndex(s);
      LiftOS.Workout.completeSet(s, idx2, { weight: 23, reps: 9, rir: 1 });
      LiftOS.Workout.clearRest(s);
      const prsBefore = s.prs.map((p) => p.label);
      const workIdxs = ex.sets.map((st, i) => ({ st, i })).filter(({ st }) => LiftOS.Stats.isWork(st) && st.completed);
      const firstWork = workIdxs[0].i;
      LiftOS.Workout.deleteCompletedSet(s, firstWork);
      const prsAfter = (s.prs || []).map((p) => p.label);
      const stillWeightPr = prsAfter.filter((l) => l === "New Weight PR").length;
      return { prsBefore, prsAfter, stillWeightPr, workSets: LiftOS.Stats.workSetCount(s) };
    });
    results.push(
      log(
        "delete completed set recalcs PRs",
        delPr.prsBefore.filter((l) => l === "New Weight PR").length >= 1 &&
          delPr.stillWeightPr === 1 &&
          delPr.workSets === 1,
        JSON.stringify(delPr)
      )
    );

    // P0-4 history correction volume uses setVolume + confirmation path + no dup
    const histCorr = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_corr",
            date: LiftOS.localDateKey(),
            planName: "P",
            volume: 100,
            workSets: 1,
            prs: 0,
            exercises: [
              {
                exerciseId: "pullup",
                name: "引体",
                sets: [
                  { type: "work", weight: 40, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 40 },
                  { type: "work", weight: 20, reps: 10, rir: 1, loadMode: "external" },
                ],
              },
            ],
          },
        ])
      );
      const entry = JSON.parse(localStorage.getItem("liftos.history"))[0];
      entry.exercises[0].sets[0].assistanceKg = 30;
      entry.exercises[0].sets[0].weight = 30;
      LiftOS.Workout.updateHistoryEntry(entry);
      const after = JSON.parse(localStorage.getItem("liftos.history"))[0];
      return { len: JSON.parse(localStorage.getItem("liftos.history")).length, volume: after.volume, workSets: after.workSets };
    });
    results.push(
      log(
        "history correction volume load-aware + no dup",
        histCorr.len === 1 && histCorr.volume === 200 && histCorr.workSets === 2,
        JSON.stringify(histCorr)
      )
    );

    // P0-5 keepAwake toggle exists
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(200);
    results.push(log("keepAwake toggle in profile UI", (await page.locator("#btnKeepAwake").count()) > 0));

    /* ===== Round 2 P0 ===== */

    // R2-P0-1 history correction UI draft survives confirm
    const histUi = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      const hist = [
        {
          id: "ws_ui_corr",
          date: LiftOS.localDateKey(),
          planName: "PUSH A",
          volume: 200,
          workSets: 1,
          prs: 0,
          exercises: [
            { exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 20, reps: 10, rir: 2, loadMode: "external" }] },
          ],
        },
      ];
      localStorage.setItem("liftos.history", JSON.stringify(hist));
      LiftOS.Storage.ensureDefaults();
      App.state.session = null;
      App.nav("data");
      return { histLen: LiftOS.Storage.getHistory().length, emptyVisible: !!document.querySelector("#dataEmpty:not(.hide)") };
    });
    await page.waitForTimeout(250);
    results.push(log("history UI setup", histUi.histLen === 1 && !histUi.emptyVisible, JSON.stringify(histUi)));
    await page.evaluate(() => App.openHistoryDetail("ws_ui_corr"));
    await page.waitForTimeout(250);
    const editorOpen = await page.locator('[data-h="r"]').count();
    results.push(log("history editor open", editorOpen > 0, String(editorOpen)));
    if (editorOpen) {
      await page.locator('[data-h="r"]').first().fill("12");
      await page.locator('[data-h="type"]').first().selectOption("amrap");
      await page.evaluate(() => App.confirmSaveHistoryCorrection());
      await page.waitForTimeout(150);
      await page.evaluate(() => App.saveHistoryCorrection());
      await page.waitForTimeout(150);
      const savedUi = await page.evaluate(() => {
        const h = LiftOS.Storage.getHistory().find((x) => x.id === "ws_ui_corr");
        return { reps: h.exercises[0].sets[0].reps, type: h.exercises[0].sets[0].type, volume: h.volume, len: LiftOS.Storage.getHistory().length };
      });
      results.push(
        log(
          "UI history correction persists after confirm",
          savedUi.reps === 12 && savedUi.type === "amrap" && savedUi.volume === 240 && savedUi.len === 1,
          JSON.stringify(savedUi)
        )
      );
    } else {
      results.push(log("UI history correction persists after confirm", false, "editor not open"));
    }

    // R2-P0-2 PR rebuild excludes old entry
    const prRebuild = await page.evaluate(() => {
      // baseline 20x10; entry had 25x10 (PR). Correct down to 18x10 → no PR
      const baseline = [
        {
          id: "ws_prior",
          date: LiftOS.localDateKey(),
          planName: "P",
          exercises: [{ exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 20, reps: 10, rir: 1, loadMode: "external" }] }],
        },
      ];
      const entryHigh = {
        id: "ws_edit",
        date: LiftOS.localDateKey(),
        planName: "P",
        startTime: Date.now(),
        exercises: [{ exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 25, reps: 10, rir: 1, loadMode: "external", completed: true }] }],
      };
      const highCount = LiftOS.Stats.rebuildEntryPRs(entryHigh, baseline);
      const entryLow = {
        id: "ws_edit",
        date: LiftOS.localDateKey(),
        planName: "P",
        startTime: Date.now(),
        exercises: [{ exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 18, reps: 10, rir: 1, loadMode: "external", completed: true }] }],
      };
      const lowCount = LiftOS.Stats.rebuildEntryPRs(entryLow, baseline);
      // two sequential: first 25x10 PR, second 25x9 not another weight PR
      const entryTwo = {
        id: "ws_edit2",
        date: LiftOS.localDateKey(),
        planName: "P",
        startTime: Date.now(),
        exercises: [
          {
            exerciseId: "incline",
            name: "上斜",
            sets: [
              { type: "work", weight: 25, reps: 10, rir: 1, loadMode: "external", completed: true },
              { type: "work", weight: 25, reps: 9, rir: 1, loadMode: "external", completed: true },
            ],
          },
        ],
      };
      const twoCount = LiftOS.Stats.rebuildEntryPRs(entryTwo, baseline);
      return { highCount, lowCount, twoCount };
    });
    results.push(log("correct down below prior → PR count 0", prRebuild.highCount >= 1 && prRebuild.lowCount === 0, JSON.stringify(prRebuild)));
    results.push(log("two sets sequential no dup weight PR", prRebuild.twoCount === 2, String(prRebuild.twoCount))); // weight+e1rm once

    // R2-P0-3 wake lock only in training
    const wl = await page.evaluate(() => {
      LiftOS.Gym.__setWakeLockCounters(0);
      // stub navigator.wakeLock
      let calls = 0;
      const fake = {
        released: false,
        addEventListener() {},
        async release() {
          this.released = true;
        },
      };
      const orig = navigator.wakeLock;
      try {
        Object.defineProperty(navigator, "wakeLock", {
          configurable: true,
          value: { request: async () => { calls += 1; return { ...fake, released: false, addEventListener() {}, async release() { this.released = true; } }; } },
        });
      } catch (_) {}
      return { canStub: !!navigator.wakeLock };
    });
    // guard test: request twice should not double if held — simulate via Gym internals after one request
    const wl2 = await page.evaluate(async () => {
      // use real API if present else fake
      if (!("wakeLock" in navigator)) {
        Object.defineProperty(navigator, "wakeLock", {
          configurable: true,
          value: {
            request: async () => ({ released: false, addEventListener() {}, async release() { this.released = true; } }),
          },
        });
      }
      LiftOS.Gym.__setWakeLockCounters(0);
      await LiftOS.Gym.requestWakeLock();
      await LiftOS.Gym.requestWakeLock();
      const held = LiftOS.Gym.wakeLockStats();
      await LiftOS.Gym.releaseWakeLock();
      const after = LiftOS.Gym.wakeLockStats();
      return { held, after };
    });
    results.push(
      log(
        "wake lock no duplicate acquire",
        wl2.held.requests <= 1 && wl2.after.held === false,
        JSON.stringify(wl2)
      )
    );

    // R2-P0-4 copy previous keeps type
    const copyType = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      LiftOS.Storage.ensureDefaults();
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      let idx = LiftOS.Workout.activeSetIndex(s);
      const ex = LiftOS.Workout.currentEx(s);
      while (idx >= 0 && ex.sets[idx].type === "warmup") {
        LiftOS.Workout.completeSet(s, idx, { weight: 10, reps: 12, rir: null });
        idx = LiftOS.Workout.activeSetIndex(s);
      }
      LiftOS.Workout.setSetType(s, idx, "amrap");
      LiftOS.Workout.completeSet(s, idx, { weight: 20, reps: 15, rir: 0, type: "amrap" });
      LiftOS.Workout.clearRest(s);
      const idx2 = LiftOS.Workout.activeSetIndex(s);
      const beforeType = ex.sets[idx2].type;
      LiftOS.Workout.copyPreviousCompletedSet(s, idx2);
      return { beforeType, afterType: ex.sets[idx2].type, reps: ex.sets[idx2].reps };
    });
    results.push(
      log(
        "copy previous does not copy amrap type",
        copyType.beforeType === "work" && copyType.afterType === "work" && copyType.reps === 15,
        JSON.stringify(copyType)
      )
    );

    // R2-P0-5 assisted Pareto mixed history
    const pareto = await page.evaluate(() => {
      const priors = [
        { assistanceKg: 40, reps: 10 },
        { assistanceKg: 30, reps: 5 },
      ];
      const cand35x10 = { assistanceKg: 35, reps: 10 };
      const cand28x10 = { assistanceKg: 28, reps: 10 }; // dominates both
      const cand35x4 = { assistanceKg: 35, reps: 4 }; // dominated by 40x10? 35<40 but 4<10 — trade-off, not dominate either way... 40x10 dominates 35x4
      return {
        imp35: LiftOS.Stats.assistedImprovement(cand35x10, priors),
        imp28: LiftOS.Stats.assistedImprovement(cand28x10, priors),
        imp35x4: LiftOS.Stats.assistedImprovement(cand35x4, priors),
      };
    });
    results.push(log("35x10 improves vs 40x10 (not only min assist)", pareto.imp35 === "pr", JSON.stringify(pareto)));
    results.push(log("28x10 dominates priors", pareto.imp28 === "pr", JSON.stringify(pareto)));
    results.push(log("35x4 dominated not PR", pareto.imp35x4 === false, JSON.stringify(pareto)));

    /* ===== Round 3 P0-1 draft restore ===== */
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_draft",
            date: LiftOS.localDateKey(),
            planName: "PUSH A",
            volume: 200,
            workSets: 1,
            prs: 0,
            exercises: [
              { exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 20, reps: 10, rir: 2, loadMode: "external" }] },
            ],
          },
        ])
      );
      LiftOS.Storage.ensureDefaults();
      App.nav("data");
      App.openHistoryDetail("ws_draft");
    });
    await page.waitForTimeout(200);
    await page.locator('[data-h="r"]').first().fill("14");
    await page.evaluate(() => App.confirmSaveHistoryCorrection());
    await page.waitForTimeout(100);
    await page.evaluate(() => App.reopenHistoryEditor());
    await page.waitForTimeout(200);
    const restored = await page.locator('[data-h="r"]').first().inputValue();
    const storedReps = await page.evaluate(() => LiftOS.Storage.getHistory().find((h) => h.id === "ws_draft").exercises[0].sets[0].reps);
    results.push(log("返回编辑 keeps unsaved draft", restored === "14" && storedReps === 10, `ui=${restored} stored=${storedReps}`));
    // delete cancel keeps draft
    await page.evaluate(() => App.confirmDeleteHistorySet(0, 0));
    await page.waitForTimeout(100);
    await page.evaluate(() => App.reopenHistoryEditor());
    await page.waitForTimeout(150);
    const restored2 = await page.locator('[data-h="r"]').first().inputValue();
    results.push(log("delete cancel keeps draft", restored2 === "14", restored2));

    /* Round 3 P0-2 assisted analytics */
    const analytics = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_a",
            date: LiftOS.daysAgo(10),
            planName: "P",
            volume: 0,
            workSets: 1,
            exercises: [
              { exerciseId: "pullup", name: "引体", sets: [{ type: "work", weight: 40, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 40 }] },
            ],
          },
          {
            id: "ws_b",
            date: LiftOS.daysAgo(2),
            planName: "P",
            volume: 0,
            workSets: 1,
            exercises: [
              { exerciseId: "pullup", name: "引体", sets: [{ type: "work", weight: 35, reps: 8, rir: 1, loadMode: "assisted", assistanceKg: 35 }] },
            ],
          },
        ])
      );
      LiftOS.Storage.ensureDefaults();
      const series = LiftOS.Stats.e1rmSeries("pullup", [], "all");
      const sum = LiftOS.Stats.summarizeHistory("all");
      const volFall = LiftOS.Storage.getHistory().reduce((a, h) => {
        return a + (h.exercises || []).reduce((b, ex) => b + (ex.sets || []).reduce((c, s) => c + LiftOS.Stats.setVolume(s), 0), 0);
      }, 0);
      return { series, pullup: sum.byExercise.pullup, volFall, sumVolume: sum.volume };
    });
    results.push(
      log(
        "assisted trend not rising on less assist",
        analytics.series.every((p) => p.value === 0),
        JSON.stringify(analytics.series)
      )
    );
    results.push(
      log(
        "summarizeHistory no assist as strength weight",
        (analytics.pullup?.weight || 0) === 0 && (analytics.pullup?.e1rm || 0) === 0 && analytics.sumVolume === 0,
        JSON.stringify(analytics.pullup) + " vol=" + analytics.sumVolume
      )
    );
    results.push(log("volumeOfHistory load-aware", analytics.volFall === 0, String(analytics.volFall)));

    /* P1 superset — cycle navigation covered in Round 4 block; keep link check */
    const ss = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      LiftOS.Storage.ensureDefaults();
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      LiftOS.Workout.linkSuperset(s);
      LiftOS.Storage.saveSession(s);
      return {
        linked: !!s.exercises[0].supersetGroup && s.exercises[0].supersetGroup === s.exercises[1]?.supersetGroup,
      };
    });
    results.push(log("superset link works", ss.linked, JSON.stringify(ss)));

    /* P1 weekly review + summary compare */
    const wr = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      const today = LiftOS.localDateKey();
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_w1",
            date: today,
            planName: "PUSH A",
            volume: 1000,
            workSets: 10,
            prs: 2,
            exercises: [
              { exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 20, reps: 10, rir: 1, loadMode: "external" }] },
            ],
          },
          {
            id: "ws_w0",
            date: LiftOS.daysAgo(7),
            planName: "PUSH A",
            volume: 800,
            workSets: 8,
            prs: 0,
            exercises: [],
          },
        ])
      );
      LiftOS.Storage.ensureDefaults();
      const w = LiftOS.Stats.weeklyReview();
      const cmp = LiftOS.Stats.compareSameRoutine({ id: "ws_w1", planName: "PUSH A", volume: 1000, workSets: 10, date: today });
      return { w, cmp };
    });
    results.push(
      log(
        "weekly review real local data",
        wr.w.sessions >= 1 && wr.w.volume >= 1000 && wr.w.prs >= 2 && wr.w.weeklyTarget === 5,
        JSON.stringify(wr.w)
      )
    );
    results.push(
      log(
        "summary compare vs previous same routine",
        wr.cmp && wr.cmp.prevVolume === 800 && wr.cmp.volumeDeltaPct === 25,
        JSON.stringify(wr.cmp)
      )
    );

    /* ===== Round 4: real superset cycle + plan persist + UI ===== */
    const ssPlan = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      LiftOS.Storage.ensureDefaults();
      const plan = LiftOS.Plans.get("pushA");
      // link first two exercises in PLAN
      const r = LiftOS.Plans.linkPlanSuperset(plan.id, 0);
      const saved = LiftOS.Plans.get(plan.id);
      // start workout — group carried into session
      const s = LiftOS.Workout.createFromPlan(saved);
      const groups = s.exercises.slice(0, 2).map((e) => e.supersetGroup);
      return { r, groups, planGroups: saved.exercises.slice(0, 2).map((e) => e.supersetGroup) };
    });
    results.push(
      log(
        "plan superset persists into session",
        ssPlan.r.ok && ssPlan.groups[0] && ssPlan.groups[0] === ssPlan.groups[1] && ssPlan.planGroups[0] === ssPlan.groups[0],
        JSON.stringify(ssPlan)
      )
    );

    // A1 → B1 no rest, B1 → rest + A2
    const cycle = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      LiftOS.Storage.ensureDefaults();
      const plan = LiftOS.Plans.get("pushA");
      // simplify: create session then force 2-work-set pair on first two exercises
      LiftOS.Plans.linkPlanSuperset(plan.id, 0);
      const s = LiftOS.Workout.createFromPlan(LiftOS.Plans.get("pushA"));
      // strip to 2 work sets each for clarity
      s.exercises.slice(0, 2).forEach((ex) => {
        ex.sets = ex.sets.filter((x) => x.type !== "warmup").slice(0, 2);
        LiftOS.Workout.renumberSets(ex);
      });
      s.exIndex = 0;
      LiftOS.Storage.saveSession(s);
      const names = [];
      const rests = [];
      function completeCurrent() {
        const ex = LiftOS.Workout.currentEx(s);
        const idx = LiftOS.Workout.activeSetIndex(s);
        if (idx < 0) return false;
        const st = ex.sets[idx];
        if (st.reps == null) st.reps = 8;
        const r = LiftOS.Workout.completeSet(s, idx, { weight: st.weight || 20, reps: 8, rir: 1 });
        names.push(LiftOS.Workout.currentEx(s).name);
        rests.push({ rest: !!s.rest, sec: r.restSeconds, nav: r.supersetNav?.movedTo || null });
        LiftOS.Workout.clearRest(s);
        return true;
      }
      // A1
      completeCurrent();
      // B1
      completeCurrent();
      // A2
      completeCurrent();
      // B2
      completeCurrent();
      return { names, rests, finalIdx: s.exIndex };
    });
    // After A1 → should be on second exercise (chest_press)
    // After B1 → wrap to first with rest
    results.push(
      log(
        "cycle A1 focuses B (partner)",
        cycle.rests[0]?.sec === 0 && cycle.rests[0]?.nav && cycle.names[0] !== cycle.names[1],
        JSON.stringify({ n: cycle.names, r: cycle.rests.slice(0, 2) })
      )
    );
    results.push(
      log(
        "B1 wrap starts round rest",
        cycle.rests[1]?.sec > 0 && cycle.rests[1]?.nav,
        JSON.stringify(cycle.rests[1])
      )
    );
    results.push(
      log(
        "A2 → B2 no rest",
        cycle.rests[2]?.sec === 0 && cycle.rests[2]?.nav,
        JSON.stringify(cycle.rests[2])
      )
    );

    // reload persist group
    const ssReload = await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      if (!s.exercises[0].supersetGroup) LiftOS.Workout.linkSuperset(s);
      LiftOS.Storage.saveSession(s);
      const before = LiftOS.Storage.getSession().exercises[0].supersetGroup;
      return before;
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(250);
    const afterReload = await page.evaluate(() => LiftOS.Storage.getSession()?.exercises?.[0]?.supersetGroup);
    results.push(log("superset survives reload", !!afterReload && afterReload === ssReload, `${ssReload}=${afterReload}`));

    // planId compare isolation
    const cmpIso = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          { id: "h1", planId: "pA", planName: "PUSH", date: LiftOS.daysAgo(3), volume: 100, workSets: 1, exercises: [] },
          { id: "h2", planId: "pB", planName: "PUSH", date: LiftOS.daysAgo(1), volume: 50, workSets: 1, exercises: [] },
        ])
      );
      LiftOS.Storage.ensureDefaults();
      const cmp = LiftOS.Stats.compareSameRoutine({ id: "live", planId: "pA", planName: "PUSH", volume: 120, workSets: 1 });
      return cmp;
    });
    results.push(
      log(
        "compare uses planId not just name",
        cmpIso && cmpIso.prevVolume === 100,
        JSON.stringify(cmpIso)
      )
    );

    // weekly review DOM muscles
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "w",
            date: LiftOS.localDateKey(),
            planName: "P",
            volume: 500,
            workSets: 4,
            prs: 0,
            exercises: [{ exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 20, reps: 8, loadMode: "external" }] }],
          },
        ])
      );
      LiftOS.Storage.ensureDefaults();
      App.nav("data");
      App.renderWeeklyReview();
    });
    await page.waitForTimeout(150);
    const wrHtml = await page.locator("#weeklyReviewCard").innerText();
    results.push(log("weekly review shows muscle sets", /胸|组/.test(wrHtml), wrHtml.replace(/\n/g, " ").slice(0, 80)));

    // top exercises DOM
    await page.evaluate(() => {
      const s = {
        id: "t",
        planName: "P",
        planId: "p",
        startTime: Date.now() - 3600000,
        exercises: [
          {
            exerciseId: "incline",
            name: "上斜哑铃卧推",
            sets: [
              { type: "work", completed: true, weight: 20, reps: 10, loadMode: "external" },
              { type: "work", completed: true, weight: 20, reps: 9, loadMode: "external" },
            ],
          },
          {
            exerciseId: "lateral",
            name: "侧平举",
            sets: [{ type: "work", completed: true, weight: 10, reps: 12, loadMode: "external" }],
          },
        ],
        prs: [],
        exIndex: 0,
      };
      App.renderSummary(s);
    });
    await page.waitForTimeout(150);
    const topHtml = await page.locator("#summaryTopEx").innerText();
    results.push(log("summary shows top exercises", /上斜/.test(topHtml), topHtml.replace(/\n/g, " ").slice(0, 80)));

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
  console.log(`\n== V0.3 GYM ${pass}/${results.length} passed, ${fail} failed ==`);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ pass, fail, results }, null, 2));
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
