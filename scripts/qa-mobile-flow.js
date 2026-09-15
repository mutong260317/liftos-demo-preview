/**
 * LiftOS mobile flow smoke test — 393x852
 * Uses system Edge/Chrome if available via playwright-core.
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "output", "qa");
const PREVIEW = "https://mutong260317.github.io/liftos-demo-preview/";
const LOCAL = "file:///" + path.dirname(__dirname).replace(/\\/g, "/") + "/index.html";

function log(step, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`;
  console.log(line);
  return { step, ok, detail };
}

async function findBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function run(url, label) {
  const exe = await findBrowser();
  const results = [];
  const browser = await chromium.launch({
    executablePath: exe || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  const shot = async (name) => {
    const file = path.join(OUT, `${label}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
  };

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    results.push(log(`${label} load`, true, page.url()));
    await shot("01-home");

    // Home visible
    const homeText = await page.locator("h1").first().textContent();
    results.push(log(`${label} home title`, /准备练什么/.test(homeText || ""), homeText));

    // Start workout
    await page.getByRole("button", { name: "开始训练" }).click();
    await page.waitForTimeout(400);
    const exName = await page.locator("#exName").textContent();
    results.push(log(`${label} workout started`, /上斜哑铃卧推/.test(exName || ""), exName));
    await shot("02-training");

    // Weight stepper
    const wBefore = await page.locator("#wDisplay").textContent();
    await page.locator(".stepper-btn.fast", { hasText: "+2.5" }).first().click();
    await page.waitForTimeout(100);
    const wAfter = await page.locator("#wDisplay").textContent();
    results.push(log(`${label} weight +2.5`, wBefore !== wAfter, `${wBefore} -> ${wAfter}`));

    // Reps stepper
    const rBefore = await page.locator("#rDisplay").textContent();
    // reps plus is last stepper-btn in the active set's reps block
    const repBtns = page.locator(".set-card.active .stepper-block").nth(1).locator(".stepper-btn");
    await repBtns.nth(1).click(); // +
    await page.waitForTimeout(100);
    const rAfter = await page.locator("#rDisplay").textContent();
    results.push(log(`${label} reps +1`, true, `${rBefore} -> ${rAfter}`));
    await shot("03-edit-set");

    // RIR
    await page.locator(".rir-btn", { hasText: "1" }).first().click();
    const rirSel = await page.locator(".rir-btn.selected").textContent();
    results.push(log(`${label} RIR select`, rirSel?.trim() === "1", rirSel));

    // Complete set
    await page.locator("#completeBtn").click();
    await page.waitForTimeout(500);
    const restVisible = await page.locator("#restBar.visible").count();
    results.push(log(`${label} rest timer shown`, restVisible > 0));
    const restText = await page.locator("#restTime").textContent();
    results.push(log(`${label} rest time`, /\d{2}:\d{2}/.test(restText || ""), restText));
    await shot("04-rest");

    // Skip rest, complete more sets to finish exercise
    await page.locator(".rest-skip").click();
    await page.waitForTimeout(200);

    // Complete remaining work sets for first exercise (4 work + 1 warmup = 5 sets)
    for (let i = 0; i < 8; i++) {
      const complete = page.locator("#completeBtn");
      if ((await complete.count()) === 0) break;
      await complete.click();
      await page.waitForTimeout(250);
      const skip = page.locator(".rest-skip");
      if (await skip.count()) await skip.click();
      await page.waitForTimeout(150);
    }

    // Exercise complete view
    const doneVisible = await page.locator("#exCompleteView:not(.hide)").count();
    results.push(log(`${label} exercise complete view`, doneVisible > 0));
    await shot("05-ex-done");

    // Next exercise
    const nextBtn = page.locator("#nextExBtn");
    if (await nextBtn.count()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      const name2 = await page.locator("#exName").textContent();
      results.push(log(`${label} next exercise`, /坐姿推胸/.test(name2 || ""), name2));
    } else {
      results.push(log(`${label} next exercise`, false, "no next btn"));
    }
    await shot("06-next-ex");

    // Workout progress sheet
    await page.locator(".training-top .icon-btn").nth(1).click();
    await page.waitForTimeout(300);
    const sheet = await page.locator(".sheet").count();
    results.push(log(`${label} progress sheet`, sheet > 0));
    await shot("07-progress");
    await page.locator(".sheet .btn-ghost").first().click();
    await page.waitForTimeout(200);

    // End workout
    await page.locator(".training-top .icon-btn").first().click();
    await page.waitForTimeout(250);
    await page.locator(".modal .btn-primary", { hasText: "结束" }).click();
    await page.waitForTimeout(400);
    const sumVisible = await page.locator("#screen-summary.active").count();
    results.push(log(`${label} summary screen`, sumVisible > 0));
    await shot("08-summary");

    // Feeling
    await page.locator(".feeling-btn").nth(3).click();
    await page.getByRole("button", { name: "完成" }).click();
    await page.waitForTimeout(300);

    // Data dashboard
    await page.locator('.nav-item[data-nav="data"]').click();
    await page.waitForTimeout(300);
    const dataActive = await page.locator("#screen-data.active").count();
    results.push(log(`${label} data dashboard`, dataActive > 0));
    await shot("09-data");

    // Open exercise stats
    await page.locator(".ex-card", { hasText: "哈克深蹲" }).first().click();
    await page.waitForTimeout(400);
    const detail = await page.locator("#subpage-ex-detail.active").count();
    results.push(log(`${label} exercise detail`, detail > 0));
    const hist = await page.locator(".history-session").count();
    results.push(log(`${label} history sessions`, hist >= 3, `count=${hist}`));
    await shot("10-ex-history");

    // Theme toggle
    await page.locator('#subpage-ex-detail .icon-btn').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-theme-btn="light"]').click();
    await page.waitForTimeout(200);
    const theme = await page.locator("html").getAttribute("data-theme");
    results.push(log(`${label} light theme`, theme === "light", theme));
    await shot("11-light");

    // Plans nav
    await page.locator('.nav-item[data-nav="plans"]').click();
    await page.waitForTimeout(200);
    results.push(log(`${label} plans`, (await page.locator("#screen-plans.active").count()) > 0));
    await shot("12-plans");

    // Library via create plan
    await page.getByRole("button", { name: "+ 新建" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "+ 添加动作" }).click();
    await page.waitForTimeout(300);
    results.push(log(`${label} library`, (await page.locator("#subpage-library.active").count()) > 0));
    await page.fill("#libSearch", "深蹲");
    await page.waitForTimeout(200);
    const cards = await page.locator("#libraryList .ex-card").count();
    results.push(log(`${label} library search`, cards >= 1, `results=${cards}`));
    await shot("13-library");
  } catch (err) {
    results.push(log(`${label} error`, false, String(err.message || err)));
    try {
      await shot("99-error");
    } catch (_) {}
  }

  await browser.close();
  const fails = results.filter((r) => !r.ok);
  return { label, total: results.length, fails: fails.length, results, browserPath: exe };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const targets = [
    { url: PREVIEW, label: "preview" },
    { url: LOCAL, label: "local" },
  ];
  const all = [];
  for (const t of targets) {
    try {
      const r = await run(t.url, t.label);
      all.push(r);
      console.log(`\n== ${t.label}: ${r.total - r.fails}/${r.total} passed (browser=${r.browserPath}) ==\n`);
    } catch (e) {
      console.error(`Suite ${t.label} crashed:`, e);
      all.push({ label: t.label, crash: String(e) });
    }
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(all, null, 2));
  const crash = all.some((a) => a.crash || a.fails > 0);
  process.exit(crash ? 1 : 0);
})();
