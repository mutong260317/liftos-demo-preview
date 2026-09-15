## Round-2 edge fixes (comment 5676210199)

**Commit:** `7a086f8afdd862d173a54dfc21182af173548bcf`

1. **Bodyweight Rep PR** — `bestSet` now accepts `weight=0` (loaded lifts still require >0). Pull-up 8→10 produces `New Rep PR`; equal reps does not. `bestE1RM` remains null for bodyweight.
2. **Add-to-plan defaults** — `Plans.resolvePlanExerciseParams` + `addExercise` use `Exercise.defaultParams`. Draft/plan add of 侧平举 → `4×12-15 / RIR1-2 / Rest 60s`. No `RIR undefined`.

### Tests
- `qa-review-fixes.js` **32/32 PASS** (new BW PR + plan-add default cases)
- `qa-v02.js` **44/44 PASS**

PR remains OPEN for merge decision.
