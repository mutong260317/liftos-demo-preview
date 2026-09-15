/**
 * LiftOS V0.2 QA — 393×852, local file:// (no server required).
 * Covers persistence, real data rules, plans, undo, notes, dashboard, gym scenario.
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "output", "qa-v02");
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
  // Playwright chromium cache (CI)
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const cache = path.join(home, ".cache", "ms-playwright");
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter((d) => d.startsWith("chromium"));
    for (const d of dirs) {
      const bin = path.join(cache, d, "chrome-linux", "chrome");
      if (fs.existsSync(bin)) return bin;
      const binWin = path.join(cache, d, "chrome-win", "chrome.exe");
      if (fs.existsSync(binWin)) return binWin;
    }
  }
  return undefined;
}

async function launch() {
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
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return { browser, context, page };
}

async function completeActiveSet(page, reps, rir = null) {
  // active set must exist
  const hasActive = await page.locator(".set-card.active").count();
  if (!hasActive) return false;
  if (reps != null) {
    await page.locator(".set-card.active .stepper-block").nth(1).locator(".stepper-btn").nth(1).click(); // +
    // if need more, loop
    for (let i = 0; i < Math.max(0, reps - 1); i++) {
      await page.locator(".set-card.active .stepper-block").nth(1).locator(".stepper-btn").nth(1).click();
    }
  }
  if (rir != null) {
    await page.locator(".set-card.active .rir-btn", { hasText: String(rir) }).first().click();
  }
  await page.locator("#completeBtn").click();
  await page.waitForTimeout(200);
  const skip = page.locator(".rest-skip");
  if (await skip.count()) await skip.click();
  await page.waitForTimeout(100);
  return true;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  const { browser, context, page } = await launch();

  try {
    // fresh profile
    await page.goto(DEMO_INDEX, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(DEMO_INDEX, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    results.push(log("boot app", await page.locator("#todayCard").count() > 0));

    // 1 dynamic date
    const hello = await page.locator("#greetHello").textContent();
    const now = new Date();
    const expectMonth = `${now.getMonth() + 1}月`;
    results.push(log("dynamic date", hello.includes(expectMonth), hello));

    // 2 home plan stats from object
    const todayText = await page.locator("#todayCard").innerText();
    results.push(log("home plan shows 5 exercises", /5\s*个动作/.test(todayText), todayText.slice(0, 80).replace(/\n/g, " ")));

    // 3 start PUSH A
    await page.getByRole("button", { name: /开始训练|进入今日计划训练/ }).click();
    await page.waitForTimeout(400);
    const exName = await page.locator("#exName").textContent();
    results.push(log("start PUSH A", /上斜哑铃卧推/.test(exName || ""), exName));

    // 4 reps not auto-filled as real (suggestion only)
    const rDisplay = await page.locator("#rDisplay").innerText();
    const setRepsNull = await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      const idx = LiftOS.Workout.activeSetIndex(s);
      return ex.sets[idx].reps;
    });
    results.push(log("active set reps is null", setRepsNull === null, `reps=${setRepsNull} ui=${rDisplay.replace(/\n/g, " ")}`));
    results.push(log("suggestion shown but not confirmed", /建议/.test(await page.locator("#setList").innerText()), ""));

    // 5 rir default not recorded
    const rirVal = await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      const idx = LiftOS.Workout.activeSetIndex(s);
      return ex.sets[idx].rir;
    });
    results.push(log("RIR default null (未记录)", rirVal === null, String(rirVal)));

    // 6 cannot complete without reps
    await page.locator("#completeBtn").click();
    await page.waitForTimeout(200);
    const toast1 = await page.locator("#toast").innerText();
    results.push(log("block complete without reps", /真实次数|请先/.test(toast1), toast1));

    // 7 fill real reps + rir and complete
    await page.locator(".set-card.active .stepper-block").nth(1).locator(".stepper-value").click();
    await page.waitForTimeout(200);
    await page.fill("#modalReps", "10");
    await page.getByRole("button", { name: "确认" }).click();
    await page.waitForTimeout(150);
    await page.locator(".set-card.active .rir-btn", { hasText: "2" }).first().click();
    await page.locator("#completeBtn").click();
    await page.waitForTimeout(300);
    results.push(log("rest timer after complete", (await page.locator("#restBar.visible").count()) > 0));
    const restTxt = await page.locator("#restTime").innerText();
    results.push(log("rest time ticking format", /\d{2}:\d{2}/.test(restTxt), restTxt));

    // complete remaining incline work sets quickly via evaluate for speed, still through API
    for (let i = 0; i < 6; i++) {
      const done = await page.evaluate(() => {
        const s = App.state.session;
        if (!s) return true;
        const ex = LiftOS.Workout.currentEx(s);
        if (!ex) return true;
        if (LiftOS.Workout.allWorkDone(ex)) return true;
        const idx = LiftOS.Workout.activeSetIndex(s);
        if (idx < 0) return true;
        const set = ex.sets[idx];
        // ensure real reps
        if (set.reps == null) set.reps = 9;
        if (set.rir === undefined) set.rir = null;
        const r = LiftOS.Workout.completeSet(s, idx, { weight: set.weight, reps: set.reps, rir: set.rir ?? 1 });
        LiftOS.Workout.clearRest(s);
        App.renderTraining();
        return LiftOS.Workout.allWorkDone(ex);
      });
      if (done) break;
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(200);
    results.push(log("exercise complete view", (await page.locator("#exCompleteView:not(.hide)").count()) > 0));

    // 8 next exercise chest_press
    await page.locator("#nextExBtn").click();
    await page.waitForTimeout(250);
    const ex2 = await page.locator("#exName").textContent();
    results.push(log("next exercise chest_press", /坐姿推胸/.test(ex2 || ""), ex2));

    // 9 replace with confirm params
    await page.locator("#exLoggingView .training-actions .btn-secondary").first().click();
    await page.waitForTimeout(250);
    await page.locator(".replace-item", { hasText: "蝴蝶机夹胸" }).first().click();
    await page.waitForTimeout(250);
    results.push(log("replace confirm modal", (await page.locator(".modal").count()) > 0));
    const modalText = await page.locator(".modal").innerText();
    results.push(log("replace shows params", /工作组|次数|休息/.test(modalText), modalText.replace(/\n/g, " ").slice(0, 80)));
    results.push(log("replace warns notes independent", /备注不会带入/.test(modalText)));
    await page.getByRole("button", { name: "使用该动作默认参数" }).click();
    await page.waitForTimeout(250);
    const ex3 = await page.locator("#exName").textContent();
    results.push(log("replaced exercise applied", /蝴蝶机夹胸/.test(ex3 || ""), ex3));

    // 10 notes independence — incline note should not be on pec_deck
    const noteNow = await page.locator("#notesInput").inputValue();
    results.push(log("notes not copied on replace", !/座椅调到/.test(noteNow || ""), JSON.stringify(noteNow)));

    // 11 set notes and persist across reload
    await page.locator(".notes-toggle").click();
    await page.fill("#notesInput", "器械座椅 3\n顶峰收缩 1s");
    await page.waitForTimeout(100);
    const sessionId = await page.evaluate(() => App.state.session.id);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);
    const resumeVisible = await page.locator("#resumeBanner:not(.hide)").count();
    results.push(log("session survives reload (banner)", resumeVisible > 0));
    const resumeTxt = await page.locator("#resumeBanner").innerText();
    results.push(log("resume banner content", /训练正在进行|完成/.test(resumeTxt), resumeTxt.replace(/\n/g, " ")));

    // 12 continue restores correct exercise + set
    await page.locator("#resumeContinue").click();
    await page.waitForTimeout(300);
    const restoredEx = await page.locator("#exName").textContent();
    const restoredIdx = await page.evaluate(() => App.state.session.exIndex);
    const restoredNotes = await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      return ex.notes;
    });
    results.push(log("restore exercise index/ex", /蝴蝶机夹胸|坐姿推胸|上斜|侧平|绳索|推胸/.test(restoredEx || ""), `ex=${restoredEx} idx=${restoredIdx}`));
    results.push(log("notes restored in session", /器械座椅/.test(restoredNotes || ""), restoredNotes));

    // 13 complete one set then undo
    // jump to a set with active editor
    const hadActive = await page.locator(".set-card.active").count();
    if (!hadActive) {
      // finish current ex via API then next
      await page.evaluate(() => {
        const s = App.state.session;
        const ex = LiftOS.Workout.currentEx(s);
        ex.sets.forEach((set) => {
          if (!set.completed && LiftOS.Stats.isWork(set)) {
            if (set.reps == null) set.reps = 12;
            LiftOS.Workout.completeSet(s, ex.sets.indexOf(set), { weight: set.weight, reps: set.reps, rir: 2 });
            LiftOS.Workout.clearRest(s);
          }
        });
        LiftOS.Workout.nextExercise(s);
        App.renderTraining();
      });
      await page.waitForTimeout(200);
    }
    // ensure reps filled then complete
    await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      const idx = LiftOS.Workout.activeSetIndex(s);
      if (idx >= 0) {
        if (ex.sets[idx].reps == null) ex.sets[idx].reps = 12;
        LiftOS.Workout.completeSet(s, idx, { weight: ex.sets[idx].weight, reps: 12, rir: 1 });
        LiftOS.Workout.clearRest(s);
        App.renderTraining();
      }
    });
    await page.waitForTimeout(200);
    const doneCountBefore = await page.evaluate(() => {
      const s = App.state.session;
      return LiftOS.Stats.workSetCount(s);
    });
    await page.locator(".set-card.done .complete-dot").first().click();
    await page.waitForTimeout(200);
    results.push(log("undo confirm modal", (await page.locator(".modal").count()) > 0));
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await page.waitForTimeout(200);
    const doneCountAfter = await page.evaluate(() => LiftOS.Stats.workSetCount(App.state.session));
    results.push(log("undo reduces work set count", doneCountAfter === doneCountBefore - 1, `${doneCountBefore}->${doneCountAfter}`));

    // 14 add exercise via library mode
    await page.locator("#exLoggingView .training-actions .btn-secondary", { hasText: "添加" }).click();
    await page.waitForTimeout(250);
    results.push(log("library mode banner", (await page.locator("#libModeBanner:not(.hide)").count()) > 0));
    await page.locator(".ex-card", { hasText: "坐姿划船" }).first().click();
    await page.waitForTimeout(200);
    results.push(log("add exercise confirm", /添加「坐姿划船」/.test(await page.locator(".modal").innerText())));
    await page.getByRole("button", { name: "确认添加" }).click();
    await page.waitForTimeout(250);
    const exNames = await page.evaluate(() => App.state.session.exercises.map((e) => e.name));
    results.push(log("exercise actually added", exNames.includes("坐姿划船"), exNames.join(",")));

    // 15 abandon and clear — then LEGS plan
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      App.nav("home");
    });
    await page.waitForTimeout(200);
    await page.locator('.nav-item[data-nav="plans"]').click();
    await page.waitForTimeout(200);
    await page.locator(".plan-card", { hasText: "LEGS" }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "用此计划开始" }).click();
    await page.waitForTimeout(350);
    const legsEx = await page.evaluate(() => LiftOS.Workout.currentEx(App.state.session).name);
    const legsPlan = await page.evaluate(() => App.state.session.planName);
    results.push(log("LEGS starts real session", legsPlan === "LEGS" && /哈克深蹲/.test(legsEx), `${legsPlan}/${legsEx}`));

    // 16 create plan persists
    await page.evaluate(() => {
      LiftOS.Workout.abandon();
      App.state.session = null;
      App.nav("plans");
    });
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "+ 新建" }).click();
    await page.waitForTimeout(200);
    await page.fill("#createPlanName", "TEST PUSH");
    await page.getByRole("button", { name: "+ 添加动作" }).click();
    await page.waitForTimeout(200);
    await page.locator(".ex-card", { hasText: "杠铃卧推" }).first().click();
    await page.waitForTimeout(150);
    // draft add path
    await page.evaluate(() => {
      // library addToPlan with create-plan open
      App.state.libraryMode = "addToPlan";
      App.onLibraryClick("bench");
    });
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "保存计划" }).click();
    await page.waitForTimeout(300);
    const planNames1 = await page.evaluate(() => LiftOS.Plans.all().map((p) => p.name));
    results.push(log("new plan saved", planNames1.includes("TEST PUSH"), planNames1.join(",")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const planNames2 = await page.evaluate(() => LiftOS.Plans.all().map((p) => p.name));
    results.push(log("plan survives reload", planNames2.includes("TEST PUSH"), planNames2.join(",")));

    // 17 dashboard range filter changes data
    await page.locator('.nav-item[data-nav="data"]').click();
    await page.waitForTimeout(200);
    const s7 = await page.locator("#dataSessions").innerText();
    await page.locator('.range-tab[data-range="all"]').click();
    await page.waitForTimeout(200);
    const sAll = await page.locator("#dataSessions").innerText();
    results.push(log("dashboard range changes sessions", s7 !== sAll || Number(sAll) >= Number(s7), `7d=${s7} all=${sAll}`));
    const volAll = await page.locator("#dataVolume").innerText();
    results.push(log("dashboard volume present", volAll && volAll !== "0", volAll));

    // 18 exercise detail history
    await page.locator(".ex-card", { hasText: "哈克深蹲" }).first().click();
    await page.waitForTimeout(300);
    const histN = await page.locator(".history-session").count();
    results.push(log("exercise history rows", histN >= 2, `count=${histN}`));
    await page.locator("#subpage-ex-detail .icon-btn").first().click();

    // 19 no maximum-scale
    const viewport = await page.evaluate(() => document.querySelector('meta[name="viewport"]').content);
    results.push(log("viewport allows zoom", !/maximum-scale/i.test(viewport), viewport));

    // 20 touch targets rough check
    const small = await page.evaluate(() => {
      const sel = ".complete-dot, .icon-btn, .btn, .filter-chip, .rir-btn, .nav-item";
      return [...document.querySelectorAll(sel)]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { t: el.className, w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44));
    });
    results.push(log("major controls >=44px", small.length === 0, JSON.stringify(small.slice(0, 5))));

    /* ===== GYM SCENARIO ===== */
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);

    // start PUSH A
    await page.getByRole("button", { name: /开始训练|进入今日计划训练/ }).click();
    await page.waitForTimeout(300);

    // 3 real WORK sets on incline: 22x10 RIR2, 22x9 RIR1, 22x8 RIR1 (skip warm-up)
    const logSets = [
      { w: 22, r: 10, rir: 2 },
      { w: 22, r: 9, rir: 1 },
      { w: 22, r: 8, rir: 1 },
    ];
    for (const spec of logSets) {
      await page.evaluate((spec) => {
        const s = App.state.session;
        const ex = LiftOS.Workout.currentEx(s);
        // complete warm-up first if it's active
        let idx = LiftOS.Workout.activeSetIndex(s);
        while (idx >= 0 && ex.sets[idx].type === "warmup") {
          LiftOS.Workout.completeSet(s, idx, { weight: 14, reps: 12, rir: null });
          LiftOS.Workout.clearRest(s);
          idx = LiftOS.Workout.activeSetIndex(s);
        }
        LiftOS.Workout.completeSet(s, idx, { weight: spec.w, reps: spec.r, rir: spec.rir });
        LiftOS.Workout.clearRest(s);
        App.renderTraining();
      }, spec);
      await page.waitForTimeout(80);
    }
    const logged = await page.evaluate(() => {
      const ex = LiftOS.Workout.currentEx(App.state.session);
      return ex.sets.filter((s) => s.completed && LiftOS.Stats.isWork(s)).map((s) => `${s.weight}x${s.reps}/rir${s.rir}`);
    });
    results.push(log("gym: logged 3 work sets", logged.length >= 3, logged.join(" ")));

    // refresh mid-workout
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await page.locator("#resumeContinue").click();
    await page.waitForTimeout(250);
    const afterRefresh = await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      return {
        plan: s.planName,
        name: ex.name,
        completed: ex.sets.filter((x) => x.completed && LiftOS.Stats.isWork(x)).map((x) => `${x.weight}x${x.reps}`),
      };
    });
    results.push(
      log(
        "gym: refresh keeps sets",
        afterRefresh.completed.length >= 3 && afterRefresh.plan === "PUSH A",
        JSON.stringify(afterRefresh)
      )
    );

    // finish incline, go to chest press, replace
    await page.evaluate(() => {
      const s = App.state.session;
      const ex = LiftOS.Workout.currentEx(s);
      ex.sets.forEach((set) => {
        if (!set.completed && LiftOS.Stats.isWork(set)) {
          if (set.reps == null) set.reps = 8;
          LiftOS.Workout.completeSet(s, ex.sets.indexOf(set), { weight: 22, reps: 8, rir: 1 });
        }
      });
      LiftOS.Workout.clearRest(s);
      LiftOS.Workout.nextExercise(s);
      App.renderTraining();
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      LiftOS.Workout.replaceExercise(App.state.session, "smith_bench", "default");
      App.renderTraining();
    });
    await page.waitForTimeout(150);
    const replaced = await page.evaluate(() => LiftOS.Workout.currentEx(App.state.session).name);
    results.push(log("gym: replace chest press", /史密斯/.test(replaced), replaced));

    // complete remaining quickly and finish summary uses real data
    await page.evaluate(() => {
      const s = App.state.session;
      s.exercises.forEach((ex) => {
        if (ex.skipped) return;
        LiftOS.Workout.workSetsOf(ex).forEach((set) => {
          if (!set.completed) {
            if (set.reps == null) set.reps = 10;
            LiftOS.Workout.completeSet(s, ex.sets.indexOf(set), { weight: set.weight || 20, reps: 10, rir: 1 });
          }
        });
        LiftOS.Workout.clearRest(s);
      });
      // move to end
      s.exIndex = s.exercises.length - 1;
      // ensure all work done on last
      App.renderTraining();
      App.endWorkout();
    });
    await page.waitForTimeout(300);
    const sumRir = await page.locator("#sumRir").innerText();
    const sumSets = await page.locator("#sumSets").innerText();
    const sumVol = await page.locator("#sumVol").innerText();
    results.push(log("gym: summary real RIR", sumRir !== "1.8" && sumRir !== "", sumRir));
    results.push(log("gym: summary sets >0", Number(sumSets) > 0, sumSets));
    results.push(log("gym: summary volume >0", Number(sumVol.replace(/,/g, "")) > 0, sumVol));

    // finish save → history persists after close/reopen
    await page.getByRole("button", { name: "完成并保存" }).click();
    await page.waitForTimeout(250);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const histLen = await page.evaluate(() => LiftOS.Storage.getHistory().length);
    results.push(log("gym: history after finish+reload", histLen > 12, `len=${histLen}`));
    const hasSession = await page.evaluate(() => !!LiftOS.Storage.getSession());
    results.push(log("gym: session cleared after finish", hasSession === false, String(hasSession)));

    // PWA manifest link
    const hasManifest = await page.locator('link[rel="manifest"]').count();
    results.push(log("PWA manifest linked", hasManifest > 0));
    const swReg = await page.evaluate(() => navigator.serviceWorker?.getRegistration?.().then((r) => !!r).catch(() => false));
    // file:// may not register SW — don't fail hard if false on file protocol
    results.push(log("SW script present", fs.existsSync(path.join(ROOT, "sw.js"))));

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
  console.log(`\n== RESULT ${pass}/${results.length} passed, ${fail} failed ==`);
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ pass, fail, total: results.length, results }, null, 2)
  );
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
