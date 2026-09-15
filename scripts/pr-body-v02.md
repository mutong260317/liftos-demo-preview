## Summary
Upgrade LiftOS from clickable demo to a gym-usable functional prototype.

### P0
- Suggestions are display-only; `reps`/`rir` stay `null` until user confirms real values
- WorkoutSession persists in localStorage (refresh → 继续训练 / 结束 / 放弃)
- Real `startWorkoutFromPlan(planId)` for PUSH A / LEGS / PULL A / PUSH B / PULL B
- Library modes: browse / addToWorkout / addToPlan / replaceExercise
- Replace requires param confirm; notes never copied across exercises
- Completed-set Undo (modal + toast undo)
- Unified SetRecord: `{ id, type: warmup|work|drop|failure, weight, reps, rir, completed, completedAt }`

### P1
- Summary computed from session (volume, sets, avg RIR or 未记录, muscles)
- PR types: Weight / Rep / e1RM (Epley, 1–12) / Volume
- Isolation vs compound metrics
- Home stats derived from plan object; dynamic date
- Dashboard range filter over real history
- Exercise notes `exerciseNotes[exerciseId]` persist across sessions
- Plan CRUD + localStorage
- Progression: rule-based Double Progression (no AI)
- PWA manifest + service worker
- Split `js/` and `css/` modules

## QA
`node scripts/qa-v02.js` → **44/44 PASS**, including mid-workout refresh gym scenario.

## Notes
- Does **not** merge; V0.1 `main` and public preview `main` untouched
- Feature branch also pushed to `liftos-demo-preview` for source review
