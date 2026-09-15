const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);
const INDEX = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";

function log(name, ok, detail = "") {
  const row = { name, ok: !!ok, detail };
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return row;
}

async function run() {
  const results = [];

  const src = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  const canonicalReducers = (src.match(/reduce\(\(a, s\) => a \+ St\.setVolume\(s\), 0\)/g) || []).length;
  results.push(log("completion + last volume use canonical helper", canonicalReducers >= 2, `count=${canonicalReducers}`));

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });

  try {
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(150);

    const ui = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("liftos.schemaVersion", "5");
      localStorage.setItem(
        "liftos.history",
        JSON.stringify([
          {
            id: "prior_assist",
            date: LiftOS.daysAgo(7),
            planId: "pull_test",
            planName: "PULL TEST",
            volume: 0,
            workSets: 1,
            exercises: [
              {
                exerciseId: "pullup",
                name: "引体向上",
                sets: [
                  {
                    id: "prior_set",
                    type: "work",
                    weight: 40,
                    reps: 8,
                    rir: 1,
                    loadMode: "assisted",
                    assistanceKg: 40,
                    addedWeightKg: null,
                    completed: true,
                  },
                ],
              },
            ],
          },
        ])
      );
      LiftOS.Storage.ensureDefaults();

      const session = {
        id: "ws_round5",
        planId: "pull_test",
        planName: "PULL TEST",
        source: "plan",
        startTime: Date.now() - 60000,
        endTime: null,
        exIndex: 0,
        exercises: [
          {
            id: "ex_round5",
            exerciseId: "pullup",
            name: "引体向上",
            muscle: "背部",
            planExercise: {
              workSets: 1,
              repMin: 6,
              repMax: 10,
              targetRirMin: 1,
              targetRirMax: 2,
              restSeconds: 90,
            },
            sets: [
              {
                id: "set_round5",
                type: "work",
                num: 1,
                weight: 35,
                reps: 8,
                rir: 1,
                durationSec: null,
                loadMode: "assisted",
                assistanceKg: 35,
                addedWeightKg: null,
                completed: true,
                completedAt: Date.now(),
              },
            ],
            skipped: false,
            advice: null,
            notes: "",
          },
        ],
        prs: [],
        rest: null,
        feeling: null,
        note: "",
        version: 2,
      };

      LiftOS.Storage.saveSession(session);
      App.state.session = session;
      App.renderTraining();

      return {
        doneVolume: document.querySelector("#doneVolume")?.textContent?.trim(),
        doneDelta: document.querySelector("#doneDelta")?.textContent?.trim(),
        assisted: LiftOS.Stats.setVolume({ type: "work", loadMode: "assisted", weight: 40, assistanceKg: 40, reps: 10 }),
        added: LiftOS.Stats.setVolume({ type: "work", loadMode: "added_weight", weight: 10, addedWeightKg: 10, reps: 8 }),
        external: LiftOS.Stats.setVolume({ type: "work", loadMode: "external", weight: 20, reps: 10 }),
      };
    });

    results.push(log("assisted completion UI volume is zero", ui.doneVolume === "0 kg", JSON.stringify(ui)));
    results.push(log("assisted prior volume produces no misleading delta", ui.doneDelta === "—", ui.doneDelta));
    results.push(log("canonical load modes unchanged", ui.assisted === 0 && ui.added === 80 && ui.external === 200, JSON.stringify(ui)));
  } catch (err) {
    results.push(log("round5 suite error", false, err.message || String(err)));
  } finally {
    await browser.close();
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n== V0.3 ROUND5 VOLUME ${pass}/${results.length} passed, ${fail} failed ==`);
  process.exit(fail ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
