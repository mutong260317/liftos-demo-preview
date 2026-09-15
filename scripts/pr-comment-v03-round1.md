## Review Round 1 fixes pushed

**Commit:** `48d99f2f61eeb1a95a93c8934cbff1dd4764bff0`

### P0
1. **Migration** — session+history consistent `loadMode`; legacy pullup `+10kg` → `added_weight` + `addedWeightKg`; `0` → `bodyweight`
2. **Load invariants** — assisted excluded from tonnage/best; `sessionBaseline`/`exerciseHistory` keep load fields; same-session assist not re-baselined; 35×6 ≠ beat 35×8
3. **deleteCompletedSet** — `recalculateSessionPRs` replays remaining sets vs history
4. **History correction** — type/duration/loadMode/assist/added fields; confirm save/delete; `setVolume` + PR recount; no duplicate
5. **Wake lock** — `keepAwake` toggle; release end/abandon/leave; re-request on `visibilitychange`

### P1
- Plate calculator true nearest (102kg bar20 → **102.5**)
- Superset / weekly review / summary-vs-previous **deferred** as named follow-up after P0 merge (will revise PR body if preferred)

### Tests
- `qa-v03` **34/34**
- `qa-v02` **44/44**
- `qa-review-fixes` **32/32**
- `qa-v021` **37/37**

Not merged; Preview unpublished.
