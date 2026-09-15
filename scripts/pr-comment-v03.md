## V0.3 Gym Experience — Delivery

**Commit:** `4cab7bb667710881e0e2f991a742bb994f9c0753` (+ CSS follow-up if any)

### P0 shipped
- Previous values shown as read-only; never auto-written as actual
- One-tap copy previous completed set / prior workout set
- Add/delete sets; completed delete confirms and recalcs PRs
- Set types: warmup/work/drop/failure/amrap
- Load modes: external/bodyweight/added_weight/assisted (no negative assist)
- Duration exercises (plank) + stopwatch; reps not required
- Rest ±15s / skip; **no rest on final set of exercise**
- Wake Lock helper (graceful fallback)
- Free workout (`planId=null`, source=free)
- History correction (edit weight/reps/RIR, delete set, recalc, no duplicate)

### P1 shipped
- Warm-up calculator (rounded, never overwrites completed work)
- Plate calculator (per-side + impossible target)

### Not in this commit (P1 remaining / deferred)
- Superset navigation
- Advanced summary vs previous routine / weekly review card

### Schema
- `CURRENT_SCHEMA_VERSION = 5`, APP `0.3.0`, SW cache `liftos-v0.3.0`
- Migration preserves V0.2.1 history/session; no `localStorage.clear()`

### Tests
| Suite | Result |
|---|---|
| qa-v03-gym-experience | **22/22** |
| qa-v02 | **44/44** |
| qa-review-fixes | **32/32** |
| qa-v021-data-safety | **37/37** |

### Guardrails
- main untouched; Preview not published; PR not merged
- No AI/social/login/cloud
