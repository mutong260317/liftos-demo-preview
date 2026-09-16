## Review Round 2 — V0.3.1 Stabilization

**Head reviewed:** `99c324d8f2ff95be7efa22264afd2c48c84b29a7`

CI is genuinely green on this head. Verified suites include `qa-v02 44/44`, `qa-review-fixes 32/32`, `qa-v021-data-safety 37/37`, `qa-v03-gym-experience 60/60`, `qa-v031-stabilization 35/35`, Round-5 volume `4/4`, plus `node --check`.

Most Round 1 fixes are correct: strict integer schema validation, prefs/session type gates, plan/session superset normalization, load-aware assisted/duration formatting, sessionStorage demo isolation, neutral avatar, and per-asset SW caching are present.

However, **do not merge yet**. Remaining blockers:

### P0-1 — Corruption warning claims a backup exists before one actually exists
`detectCorruption()` only detects; it does not call `preserveCorruptValue()`. The app then shows: `部分本地数据损坏，已备份原始内容...`, but no `liftos.corrupt.*` recovery key exists until a later destructive `write()` happens.

Worse, `exportPayload()` still reads a corrupt business key through the fallback path (`history -> []`, etc.), so a user can immediately export an apparently valid but incomplete backup after seeing the misleading “已备份” toast.

**Required:**
- On corruption detection at startup, immediately preserve each corrupt business key's exact raw bytes to a recovery key **before** rendering normal data, OR change the flow so normal export/destructive actions are blocked until preservation succeeds.
- Never claim “已备份” unless a recovery copy was actually created.
- Normal export must not silently turn corrupt history/plans/prefs into empty fallback data. Either reject normal export with a clear recovery message or include an explicit recovery payload.
- Add real tests for corrupt `history`, `plans`, and `prefs` (Round 1 explicitly requested all three), including startup preservation and export behavior.

### P0-2 — Stopwatch can survive an exercise change and target the wrong set
The new cleanup only runs on `abandonWorkout`, `endWorkout`, and `finishSummary`.

But `nav()` leaving training, `skipExercise()`, `nextExercise()`, and `applyReplace()` do not stop the stopwatch. More importantly, stopwatch state stores only `stopwatchSetIdx`; `stopStopwatch(false)` later calls `Workout.updateSetField(state.session, stopwatchSetIdx, ...)`, which operates on the **current exercise**. If the exercise changed while the old stopwatch was still running, elapsed seconds can be written to a different exercise/set.

The current QA named `stopwatch cleaned on abandon` does not verify cleanup at all — it only checks that `App.stopStopwatch` exists after calling abandon.

**Required:**
- Bind stopwatch identity to session + exercise id/object + set id, not only set index, or guarantee centralized cleanup before every path that changes/invalidates the active exercise/set.
- Cleanup on at least: nav away from training, skip, next exercise, replace, end, abandon, finish, and completed/deleted active duration set.
- Add a real async test: start timer → change/skip/replace exercise → wait → verify timer stopped and no other set receives `durationSec`.

### P1-1 — Required real Service Worker/offline smoke is still missing
Round 1 explicitly asked for an actual HTTP-origin service-worker/offline test. `qa-v031-stabilization` still boots from `file://` and only string-checks `sw.js` (`ASSETS.map`). That does not validate registration, install cache, offline reload, or fetch fallback.

Also, the install handler catches even the second core-shell `index.html/version.json` adds, so the SW can still activate with no usable core shell if those fail.

**Required:**
- Add a local HTTP Playwright smoke (127.0.0.1 is fine): wait for SW ready/controller → verify core cache → set browser offline → reload → app shell boots.
- Simulate/cover one optional asset cache failure while core shell still works if practical.
- Core-shell caching failure should fail install rather than silently activate an unusable SW; optional assets may fail independently.

### P1-2 — Active workout can still be force-reloaded by `controllerchange`
`navigator.serviceWorker.controllerchange` unconditionally calls `location.reload()`. The button path protects an active workout, but another tab / externally activated waiting worker can still trigger `controllerchange` and interrupt an active set.

**Required:** if an active workout exists, do not auto-reload on `controllerchange`; persist state and defer reload until the workout is finished. Add a targeted regression test.

### P1-3 — UI regression tests requested in Round 1 are still mostly formatter tests
The production UI now uses `Gym.formatLoad`, which is good, but the new tests named `undo/detail assisted format` and `undo/detail duration format` call `Gym.formatLoad()` directly. They do not open Undo or Exercise Detail DOM.

**Required:** add at least one real DOM test for assisted Undo and one for plank/assisted exercise history detail so the actual UI path cannot regress back to raw `weight`.

### P2 / audit trail cleanup
- `docs/V0.3.1_AUDIT.md` and PR Description still report only the original 5 P0 / 4 P1 findings and `18/18`, so the canonical audit is now stale. Update it with Round 1 findings/fixes and the current test count.
- `scripts/qa-preview-v03-smoke.js` asserts 0.3.1 correctly, but its file header still says `V0.3.0`; update the label while here.

Keep schema at v5 unless a persisted shape truly changes. Keep all existing suites green. Do not merge or publish Preview.

When complete, post: new SHA, updated test counts, CI, remaining P0/P1, merge-ready yes/no.
