const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const raw = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const enc = "file:///" + ROOT.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/") + "/index.html";

function findBrowser() {
  const c = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return c.find((p) => fs.existsSync(p));
}

(async () => {
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ["--no-sandbox"] });
  for (const [label, url] of [["raw", raw], ["enc", enc]]) {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log(label, "pageerror", e.message));
    page.on("console", (m) => {
      if (m.type() === "error") console.log(label, "console", m.text());
    });
    try {
      await page.goto(url, { waitUntil: "load", timeout: 10000 });
      await page.waitForTimeout(400);
      const t = await page.evaluate(() => typeof window.LiftOS);
      console.log(label, "type", t, "url", url);
    } catch (e) {
      console.log(label, "goto fail", e.message);
    }
    await page.close();
  }
  await browser.close();
})();
