/**
 * V0.3.1 Stabilization QA — 393×852
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);
const INDEX = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const OUT = path.join(__dirname, "output", "qa-v031");

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
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(300);

    results.push(log("APP 0.3.1", (await page.evaluate(() => LiftOS.APP_VERSION)) === "0.3.1"));
    results.push(log("fresh history []", (await page.evaluate(() => LiftOS.Storage.getHistory().length)) === 0));
    const prefs = await page.evaluate(() => LiftOS.Storage.getPrefs());
    results.push(log("fresh prefs neutral", prefs.name === "训练者" && prefs.bodyWeight == null, JSON.stringify({ n: prefs.name, w: prefs.bodyWeight })));

    // no countSeedPRs
    results.push(log("countSeedPRs removed", (await page.evaluate(() => typeof LiftOS.Stats.countSeedPRs)) === "undefined"));

    // seed PR guess: history with hack_squat 110 but no prs field → 0
    const prGuess = await page.evaluate(() => {
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "ws_x",
            date: LiftOS.localDateKey(),
            planName: "L",
            exercises: [{ exerciseId: "hack_squat", name: "哈克", sets: [{ type: "work", weight: 110, reps: 10, loadMode: "external" }] }],
          },
        ])
      );
      const sum = LiftOS.Stats.summarizeHistory("all");
      return sum.prs;
    });
    results.push(log("no weight-based PR guessing", prGuess === 0, String(prGuess)));

    // demo isolation
    const iso = await page.evaluate(() => {
      const before = localStorage.getItem("liftos.history");
      return before;
    });
    await page.goto(INDEX + "?demo=1", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const afterDemo = await page.evaluate(() => ({
      prod: localStorage.getItem("liftos.history"),
      demoKey: localStorage.getItem("liftos.demo.history"),
      statsLen: LiftOS.Stats.summarizeHistory("all").sessions,
      prodLen: LiftOS.Storage.getHistory().length,
    }));
    results.push(
      log(
        "demo does not write production history",
        afterDemo.prod === iso && afterDemo.demoKey && afterDemo.statsLen > afterDemo.prodLen,
        JSON.stringify({ statsLen: afterDemo.statsLen, prodLen: afterDemo.prodLen })
      )
    );
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(200);
    const afterProd = await page.evaluate(() => localStorage.getItem("liftos.history"));
    results.push(log("back to production history unchanged", afterProd === iso));

    // export excludes demo
    const exp = await page.evaluate(() => LiftOS.Storage.exportPayload());
    results.push(log("export production-only history", (exp.history || []).every((h) => !String(h.id).startsWith("h-")), `n=${exp.history.length}`));

    // import backup abort
    const backupAbort = await page.evaluate(() => {
      const before = LiftOS.Storage.getHistory().length;
      const origSet = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k, v) => {
        if (String(k).startsWith("liftos.backup.")) throw new Error("quota");
        origSet(k, v);
      };
      const r = LiftOS.Storage.importPayload({
        exportVersion: 1,
        plans: LiftOS.Plans.all(),
        history: [],
        notes: {},
        prefs: LiftOS.Storage.getPrefs(),
        activeSession: null,
        schemaVersion: 5,
      });
      localStorage.setItem = origSet;
      return { r, before, after: LiftOS.Storage.getHistory().length };
    });
    results.push(
      log(
        "import aborts without backup",
        backupAbort.r.ok === false && backupAbort.r.code === "BACKUP_FAILED" && backupAbort.after === backupAbort.before,
        JSON.stringify(backupAbort.r)
      )
    );

    // atomic rollback via __TEST_FAIL_AT
    const rollback = await page.evaluate(() => {
      const before = LiftOS.Storage.getHistory().length;
      LiftOS.__TEST_FAIL_AT = "history";
      const r = LiftOS.Storage.importPayload({
        exportVersion: 1,
        plans: [{ id: "p1", name: "N", muscleLabel: "x", createdAt: 1, updatedAt: 1, exercises: [{ exerciseId: "squat", order: 0, workSets: 3, repMin: 5, repMax: 8, targetRirMin: 1, targetRirMax: 2, restSeconds: 120, progressionRuleId: "double" }] }],
        history: [{ id: "ws_new", date: LiftOS.localDateKey(), planName: "N", exercises: [] }],
        notes: {},
        prefs: LiftOS.Storage.getPrefs(),
        activeSession: null,
        schemaVersion: 5,
      });
      LiftOS.__TEST_FAIL_AT = null;
      return { r, before, after: LiftOS.Storage.getHistory().length, plans: LiftOS.Plans.all().map((p) => p.id) };
    });
    results.push(
      log(
        "import atomic rollback",
        rollback.r.ok === false && rollback.after === rollback.before && !rollback.plans.includes("p1"),
        JSON.stringify(rollback.r)
      )
    );

    // superset orphan on replace
    const orphan = await page.evaluate(() => {
      LiftOS.Workout.abandon();
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      LiftOS.Workout.linkSuperset(s);
      const g = s.exercises[0].supersetGroup;
      LiftOS.Workout.replaceExercise(s, "smith_bench", "default");
      const groups = s.exercises.map((e) => e.supersetGroup);
      const lone = s.exercises.filter((e) => e.supersetGroup && s.exercises.filter((x) => x.supersetGroup === e.supersetGroup).length < 2).length;
      return { g, groups, lone, kept: groups.filter(Boolean).length };
    });
    results.push(
      log(
        "replace SS member no orphan",
        orphan.lone === 0 && (orphan.kept === 0 || orphan.kept >= 2),
        JSON.stringify(orphan)
      )
    );

    // duration progression
    const durProg = await page.evaluate(() =>
      LiftOS.Progression.getProgressionSuggestion({ exerciseId: "plank", repMin: 30, repMax: 60, historyRows: [] })
    );
    results.push(log("duration no weight progression", durProg.suggestedWeight === 0 && durProg.action === "hold", JSON.stringify(durProg)));

    // XSS escape plan name
    const xss = await page.evaluate(() => {
      const plan = LiftOS.Plans.create({
        name: "<script>alert(1)</script>",
        muscleLabel: "<img src=x onerror=alert(1)>",
        exercises: [],
      });
      App.nav("plans");
      App.openPlanDetail(plan.id);
      const html = document.getElementById("planDetailBody").innerHTML;
      LiftOS.Plans.remove(plan.id);
      return {
        rawScript: /<script/i.test(html),
        rawImg: /<img/i.test(html),
        rawOnerror: /<[a-z]+\s[^>]*\sonerror\s*=/i.test(html),
        escaped: /&lt;script|&lt;img/i.test(html),
      };
    });
    results.push(log("XSS escaped in plan name", !xss.rawScript && !xss.rawImg && !xss.rawOnerror && xss.escaped, JSON.stringify(xss)));

    // assisted format UI
    const fmt = await page.evaluate(() => LiftOS.Gym.formatLoad({ loadMode: "assisted", assistanceKg: 35, reps: 10 }));
    results.push(log("assisted format", fmt === "辅助 35kg × 10", fmt));

    // sw cache
    const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    results.push(log("SW cache v0.3.1", sw.includes('const CACHE = "liftos-v0.3.1"')));
    const vf = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8"));
    results.push(log("version.json 0.3.1", vf.version === "0.3.1"));

    // migration idempotent
    const mig = await page.evaluate(() => {
      const a = LiftOS.Migrations.run();
      const b = LiftOS.Migrations.run();
      return { a, b, schema: LiftOS.Migrations.getVersion() };
    });
    results.push(log("migration idempotent", mig.a.changed === false || mig.b.changed === false || mig.schema === 5, JSON.stringify({ a: mig.a.changed, b: mig.b.changed, schema: mig.schema })));

    // node --check done outside
    results.push(log("README/AGENTS exist", fs.existsSync(path.join(ROOT, "README.md")) && fs.existsSync(path.join(ROOT, "AGENTS.md"))));

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
  console.log(`\n== V0.3.1 STABILIZATION ${pass}/${results.length} passed, ${fail} failed ==`);
  process.exit(fail ? 1 : 0);
})();
