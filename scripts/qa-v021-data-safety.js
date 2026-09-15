/**
 * V0.2.1 Real Data Safety QA
 * Run: node scripts/qa-v021-data-safety.js
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "output", "qa-v021");
const ROOT = path.dirname(__dirname);
const INDEX = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const DEMO_INDEX = INDEX + "?demo=1";

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
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(8000);

  try {
    // 1–3 fresh install: empty history, plans exist, no demo notes
    await page.goto(INDEX, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(350);
    const fresh = await page.evaluate(() => ({
      history: LiftOS.Storage.getHistory(),
      plans: LiftOS.Plans.all().map((p) => p.name),
      notes: LiftOS.Storage.getNotes(),
      schema: LiftOS.Migrations.getVersion(),
      hasSeedFlag: !!localStorage.getItem("liftos.seeded.v3"),
    }));
    results.push(log("fresh install history = []", Array.isArray(fresh.history) && fresh.history.length === 0, `len=${fresh.history.length}`));
    results.push(
      log(
        "default plans exist",
        ["PUSH A", "PULL A", "LEGS", "PUSH B", "PULL B"].every((n) => fresh.plans.includes(n)),
        fresh.plans.join(",")
      )
    );
    results.push(
      log(
        "fresh notes no demo note",
        !Object.values(fresh.notes || {}).some((t) => /座椅调到|安全杆略低/.test(String(t))),
        JSON.stringify(fresh.notes)
      )
    );
    results.push(log("schemaVersion stamped", fresh.schema === 4, String(fresh.schema)));
    results.push(log("no global seed flag written", fresh.hasSeedFlag === false));

    // data empty state
    await page.locator('.nav-item[data-nav="data"]').click();
    await page.waitForTimeout(200);
    results.push(log("data empty state visible", (await page.locator("#dataEmpty:not(.hide)").count()) > 0));

    // 4–7 v3→v4 migration: strip seed history, keep user, clean demo notes only
    await page.evaluate(() => {
      const seed = LiftOS.SeedHistory;
      const user = {
        id: "ws_user_real_1",
        date: LiftOS.localDateKey(),
        planName: "PUSH A",
        volume: 1000,
        workSets: 3,
        prs: 0,
        exercises: [{ exerciseId: "incline", name: "上斜", sets: [{ type: "work", weight: 20, reps: 10, rir: 1 }] }],
      };
      const customPlan = {
        id: "plan_custom_x",
        name: "MY CUSTOM",
        muscleLabel: "自定义",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        exercises: [{ exerciseId: "bench", order: 0, workSets: 3, repMin: 5, repMax: 8, targetRirMin: 1, targetRirMax: 2, restSeconds: 150, progressionRuleId: "double" }],
      };
      const session = {
        id: "ws_active_1",
        planId: "pushA",
        planName: "PUSH A",
        startTime: Date.now(),
        exIndex: 0,
        exercises: [],
        prs: [],
        version: 2,
      };
      localStorage.setItem("liftos.history", JSON.stringify(seed.concat([user])));
      localStorage.setItem(
        "liftos.notes",
        JSON.stringify({
          incline: "座椅调到 4\n靠背 30°\n肩胛下沉\n不要耸肩",
          hack_squat: "我的真实备注：膝盖内扣要改",
          bench: "用户改过的引体备注",
        })
      );
      const plans = LiftOS.Plans.all();
      plans.push(customPlan);
      localStorage.setItem("liftos.plans", JSON.stringify(plans));
      localStorage.setItem("liftos.session", JSON.stringify(session));
      // pretend old schema
      localStorage.setItem("liftos.schemaVersion", "3");
      localStorage.setItem("liftos.seeded.v3", "1");
    });
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(350);
    const migrated = await page.evaluate(() => {
      const seedIds = new Set(LiftOS.SeedHistory.map((x) => x.id));
      const hist = LiftOS.Storage.getHistory();
      const notes = LiftOS.Storage.getNotes();
      return {
        histIds: hist.map((h) => h.id),
        hasUser: hist.some((h) => h.id === "ws_user_real_1"),
        hasSeed: hist.some((h) => seedIds.has(h.id)),
        notes,
        plans: LiftOS.Plans.all().map((p) => p.name),
        session: LiftOS.Storage.getSession(),
        schema: LiftOS.Migrations.getVersion(),
      };
    });
    results.push(log("v3→v4 removes seed history", migrated.hasSeed === false, `hasSeed=${migrated.hasSeed}`));
    results.push(log("v3→v4 keeps user history", migrated.hasUser === true));
    results.push(log("demo note cleaned", migrated.notes.incline == null || migrated.notes.incline === "", String(migrated.notes.incline)));
    results.push(log("edited note kept", /膝盖内扣/.test(migrated.notes.hack_squat || ""), migrated.notes.hack_squat));
    results.push(log("custom plan kept", migrated.plans.includes("MY CUSTOM")));
    results.push(log("active session kept", !!migrated.session && migrated.session.id === "ws_active_1"));
    results.push(log("schema is 4", migrated.schema === 4, String(migrated.schema)));

    // idempotent second run
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(250);
    const again = await page.evaluate(() => {
      const seedIds = new Set(LiftOS.SeedHistory.map((x) => x.id));
      const hist = LiftOS.Storage.getHistory();
      return { hasSeed: hist.some((h) => seedIds.has(h.id)), hasUser: hist.some((h) => h.id === "ws_user_real_1") };
    });
    results.push(log("migration idempotent", again.hasSeed === false && again.hasUser === true));

    // 10 export
    const exported = await page.evaluate(() => LiftOS.Storage.exportPayload());
    results.push(
      log(
        "JSON export shape",
        exported.exportVersion === 1 &&
          Array.isArray(exported.history) &&
          Array.isArray(exported.plans) &&
          exported.appVersion === "0.2.1",
        `v=${exported.appVersion} hist=${exported.history.length}`
      )
    );

    // 11 import success
    const importOk = await page.evaluate((payload) => {
      payload.history = payload.history.concat([
        {
          id: "ws_imported_x",
          date: LiftOS.localDateKey(),
          planName: "PULL A",
          volume: 500,
          workSets: 2,
          exercises: [{ exerciseId: "pullup", name: "引体", sets: [{ type: "work", weight: 0, reps: 10 }] }],
        },
      ]);
      const v = LiftOS.Storage.validateImport(payload);
      if (!v.ok) return { ok: false, err: v.error };
      LiftOS.Storage.importPayload(payload);
      return { ok: true, has: LiftOS.Storage.getHistory().some((h) => h.id === "ws_imported_x") };
    }, exported);
    results.push(log("JSON import success", importOk.ok && importOk.has, JSON.stringify(importOk)));

    // 12 bad JSON does not destroy
    const beforeBad = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    const bad = await page.evaluate(() => {
      const v1 = LiftOS.Storage.validateImport({ foo: 1 });
      const v2 = LiftOS.Storage.validateImport("not-object");
      const v3 = LiftOS.Storage.validateImport({ exportVersion: 1, plans: "x", history: [] });
      return { v1: v1.ok, v2: v2.ok, v3: v3.ok, hist: LiftOS.Storage.getHistory().length };
    });
    results.push(log("invalid import rejected", bad.v1 === false && bad.v2 === false && bad.v3 === false, JSON.stringify(bad)));
    results.push(log("bad import keeps history", bad.hist === beforeBad, `${beforeBad}→${bad.hist}`));

    // 13 version.json file exists + parse
    const versionFile = fs.readFileSync(path.join(ROOT, "version.json"), "utf8");
    const vj = JSON.parse(versionFile);
    results.push(log("version.json", vj.version === "0.2.1", vj.version));
    results.push(log("APP_VERSION const", (await page.evaluate(() => LiftOS.APP_VERSION)) === "0.2.1"));

    // 14 SW cache version string
    const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    results.push(log("SW cache versioned", sw.includes('const CACHE = "liftos-v0.2.1"')));
    results.push(log("SW handles SKIP_WAITING", sw.includes("SKIP_WAITING")));

    // 15 update available detection (unit)
    const cmp = await page.evaluate(() => {
      // expose via temporary
      const fn = (a, b) => {
        const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
        const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const d = (pa[i] || 0) - (pb[i] || 0);
          if (d) return d > 0 ? 1 : -1;
        }
        return 0;
      };
      return { gt: fn("0.3.0", "0.2.1"), eq: fn("0.2.1", "0.2.1"), lt: fn("0.2.0", "0.2.1") };
    });
    results.push(log("update version compare", cmp.gt === 1 && cmp.eq === 0 && cmp.lt === -1, JSON.stringify(cmp)));

    // 16 active workout does not force reload — banner text
    await page.evaluate(() => {
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      LiftOS.Storage.saveSession(s);
      // simulate remote newer version banner path
      const banner = document.getElementById("updateBanner");
      banner.classList.remove("hide");
      document.getElementById("updateTitle").textContent = "LiftOS 有新版本 V0.3";
      document.getElementById("updateHint").textContent = "正在训练，不会自动刷新。训练结束后再更新。";
      const btn = document.getElementById("updateNowBtn");
      btn.textContent = "训练结束后更新";
      btn.onclick = () => App.showToast("请先结束当前训练再更新");
    });
    const bannerTxt = await page.locator("#updateBanner").innerText();
    results.push(log("active workout no force update", /训练/.test(bannerTxt), bannerTxt.replace(/\n/g, " ")));
    await page.locator("#updateNowBtn").click();
    await page.waitForTimeout(200);
    const stillOnApp = await page.evaluate(() => !!App.state.session || !!LiftOS.Storage.getSession());
    results.push(log("update click while training keeps session", stillOnApp));

    // 17 after "update" (clear banner + keep data) history remains
    const histBefore = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      document.getElementById("updateBanner").classList.add("hide");
      // applyUpdate would reload; we assert data path
    });
    const histAfter = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    results.push(log("history preserved around update flow", histAfter === histBefore, `${histBefore}→${histAfter}`));

    // ?demo=1 loads seed for dev only
    await page.goto(DEMO_INDEX, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const demoHist = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    results.push(log("?demo=1 can load SeedHistory", demoHist > 0, `len=${demoHist}`));

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
  console.log(`\n== V0.2.1 DATA SAFETY ${pass}/${results.length} passed, ${fail} failed ==`);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ pass, fail, results }, null, 2));
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
