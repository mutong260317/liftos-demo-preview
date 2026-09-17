## Summary
V0.3.1 Stabilization Audit — no new features; P0/P1 cleanup on V0.3.0 baseline.

Canonical audit: `docs/V0.3.1_AUDIT.md`

### P0 fixed (5/5)
1. Removed `countSeedPRs` weight→PR guessing — PR count only from real `h.prs`
2. Demo `?demo=1` uses `liftos.demo.history` overlay; production keys untouched
3. Import **aborts** if pre-import backup fails (`BACKUP_FAILED`)
4. `replaceExercise` superset orphan cleanup (inherit group or unlink all)
5. Duration exercises: progression hold, no fake kg progression

### P1 fixed (4/4)
- Neutral fresh prefs (`训练者`, `bodyWeight: null`)
- Removed unused `importSchema` / public `__failAt` (now `LiftOS.__TEST_FAIL_AT`)
- APP_VERSION / version.json / SW cache → **0.3.1**
- Assisted display/stat semantics kept load-aware

### Schema
**Unchanged (v5)** — app-only stabilization.

### Tests
| Suite | Result |
|-------|--------|
| qa-v031-stabilization | **18/18** |
| qa-v02 | **44/44** |
| qa-review-fixes | **32/32** |
| qa-v021-data-safety | **37/37** |
| qa-v03-gym-experience | **60/60** |

### Not merged
Awaiting Review. No Preview publish.
