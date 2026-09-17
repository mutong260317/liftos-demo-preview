## V0.3.1 Review Round 2 — Completion

**SHA:** `74b5d7ea8aaef9de064606856507fc33f0684190`

### P0
- Startup `preserveAllCorruptKeys()`; toast only after recovery copy exists
- `exportPayload()` throws `CORRUPT_EXPORT_PRESERVED` (no silent empty export)
- Stopwatch bound to session/exercise/set id; cleanup on nav/skip/next/replace/end/abandon/finish/delete; no cross-exercise writes

### P1
- `qa-v031-sw-http.js`: HTTP SW ready + offline reload + controllerchange guard
- Core shell install required; optional assets independent
- DOM tests: assisted Undo modal, plank history detail
- AUDIT.md + preview smoke header updated

### Tests
- qa-v031 **40/40**
- sw-http **4/4**
- qa-v02 44/44 · review 32/32 · v021 37/37 · v03 60/60
- node --check pass

Schema **v5** unchanged. Not merged; Preview unpublished.
