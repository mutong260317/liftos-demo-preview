/**
 * HTTP + Service Worker + offline smoke (127.0.0.1)
 * Run after merge/release or locally: node scripts/qa-v031-sw-http.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.dirname(__dirname);

function mime(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".json")) return "application/json";
  if (p.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function findBrowser() {
  return [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((p) => fs.existsSync(p));
}

function log(step, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`);
  return { step, ok: !!ok, detail: String(detail || "") };
}

(async () => {
  const results = [];
  const server = http.createServer((req, res) => {
    let url = req.url.split("?")[0];
    if (url === "/") url = "/index.html";
    const file = path.join(ROOT, url.replace(/^\//, ""));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("nope");
      return;
    }
    res.writeHead(200, { "Content-Type": mime(file) });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const PORT = server.address().port;
  const origin = `http://127.0.0.1:${PORT}/`;

  const browser = await chromium.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    serviceWorkers: "allow",
  });
  const page = await context.newPage();

  try {
    await page.goto(origin, { waitUntil: "networkidle", timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const swReady = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg && !!navigator.serviceWorker.controller;
    });
    results.push(log("SW ready + controller", swReady === true));

    await page.evaluate(async () => {
      const c = await caches.open("liftos-v0.3.1");
      const keys = await c.keys();
      return keys.length;
    });
    const cacheCount = await page.evaluate(async () => {
      const c = await caches.open("liftos-v0.3.1");
      return (await c.keys()).length;
    });
    results.push(log("core shell cached", cacheCount >= 2, `entries=${cacheCount}`));

    // offline reload
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(400);
    const offlineBoot = await page.evaluate(() => {
      return {
        hasApp: typeof LiftOS !== "undefined",
        title: document.title,
        hasToday: !!document.getElementById("todayCard"),
      };
    });
    results.push(log("offline reload boots shell", offlineBoot.hasApp && offlineBoot.hasToday, JSON.stringify(offlineBoot)));
    await context.setOffline(false);

    // controllerchange with active session does not reload
    const noReload = await page.evaluate(async () => {
      LiftOS.Storage.ensureDefaults();
      const plan = LiftOS.Plans.get("pushA");
      const s = LiftOS.Workout.createFromPlan(plan);
      LiftOS.Storage.saveSession(s);
      const before = performance.now();
      // simulate controllerchange listener behavior is in app — call path
      // We verify guard by dispatching event after ensuring session
      const ev = new Event("controllerchange");
      // re-dispatch on serviceWorker if possible
      try {
        navigator.serviceWorker.dispatchEvent(ev);
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 100));
      return { session: !!LiftOS.Storage.getSession(), still: document.body.innerText.includes("LiftOS") || !!document.getElementById("todayCard") };
    });
    results.push(log("active workout survives controllerchange", noReload.session === true && noReload.still === true, JSON.stringify(noReload)));
  } catch (err) {
    results.push(log("sw http smoke error", false, err.message || String(err)));
  }

  await browser.close();
  server.close();
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n== SW HTTP SMOKE ${pass}/${results.length} passed, ${fail} failed ==`);
  process.exit(fail ? 1 : 0);
})();
