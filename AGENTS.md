# LiftOS Agent Rules

## Source of truth
- GitHub PR Description + **latest** Review Comment are authoritative.
- Order: **latest explicit Review > older Review > PR Description > docs/**.
- Do not invent scope from chat history alone.

## Git workflow
- Work only on the **current PR branch**.
- Never push to `main` directly.
- Never merge PRs yourself.
- Never publish Public Preview unless a Review explicitly asks.
- After work: push branch, wait CI green, post PR completion comment.

## Product principles
- **Real training data only** — no SeedHistory/Mock/PR guessing in production.
- Demo data (`?demo=1`) must use isolated overlay; must not write production history/plans/notes/prefs/session.
- Suggestions ≠ actual records. Previous / Suggested / Actual stay distinct.
- Assisted load is not strength tonnage (lower assistance = stronger).
- Do not auto-reload during an active workout.

## Data rules
- Any persisted schema change requires `CURRENT_SCHEMA_VERSION` bump + idempotent migration.
- Never `localStorage.clear()` for migrations.
- Import must be atomic: no backup → no destructive write.
- Reject `exportVersion`/`schemaVersion` from the future.

## Engineering
- Keep existing QA green; add targeted tests for each Review fix.
- No scope creep (no Supabase/login/cloud/AI/HealthKit unless the PR says so).
- Prefer small, reviewable diffs.
- Run `node --check` on edited JS before push.

## Definition of done
- Review items addressed (or explicitly deferred in docs + PR comment).
- CI success on the branch.
- PR completion comment: SHA, what changed, test counts, known gaps.
