# Update the existing installation — 14 October 2026

This update keeps the existing project and username/password accounts. It does not require new users, passwords, email codes, signup or SMTP.

## Apply just the new migration

1. In your existing Supabase project, open **SQL Editor → New snippet**.
2. Paste and run **`supabase/migrations/202610140004_scoring_v2.sql`** once. Do not rerun the original migrations. The new file is transactional and includes the settings-save compatibility fix, even if the earlier `202610120003_settings_where_clause.sql` fix was applied separately.
3. Confirm success. The script never replaces/deletes Auth users, profile roles, tasks, daily history, tests, private proofs, challenges or rewards. It adds settings columns and replaces the scoring/settings functions. It leaves the Cron job unchanged.
4. Reload the updated app. Sign in privately as Host and open **Our Journey → Host settings & challenge controls**. Check the next-challenge weights and practice target. Use **Preview new calculation** to inspect current work under proposed rules, without saving or awarding points. **Save settings** schedules those rules for the next challenge; the exam date still applies immediately.

No privileged key needs to be shared with the assistant. Apply the SQL from your own existing dashboard session. If using the CLI, use `supabase db push` only when the existing migration history is correctly tracked; do not blindly replay migrations that were applied manually.

The migration sets the next-challenge weights to **70 / 15 / 15** and the practice target to **2 papers per subject**. It preserves your configured qualifying score, active-day threshold, on-time threshold and exam date, and audits the previous settings. You can adjust the next-challenge rules afterward. Existing active and archived `rules` JSON is untouched. Rules without `rules_version` are treated as v1; newly created challenges freeze the complete v2 settings. Each archived challenge retains its exact rules and score snapshot.

## Scoring and fairness

- **Tasks (70 default):** weight × original obligations completed on their original Colombo due date ÷ original obligations due in the challenge. Zero obligations earns zero. Carryovers never multiply the denominator; future tasks enter only when due. Historical completion remains protected.
- **Practice (15 default):** each of the three subjects earns one third of the weight × min(approved eligible papers ÷ per-subject target, 1). With the defaults, each subject earns up to 5 points for two papers.
- **Performance (15 default):** each subject earns one third of the weight × its mean normalized percentage ÷ 100. A missing subject contributes zero. Every approved eligible paper contributes to that subject's average, including papers beyond the practice cap. A subject with more papers does not receive extra weight.
- The database uses PostgreSQL `numeric`, sums without display rounding and clamps the total to 0–100. The interface rounds to one decimal; individually rounded components can differ slightly from the rounded total.
- Default eligibility remains score ≥85, 20 qualifying active days, 80% on-time completion and at least one approved paper in each subject. The two-paper target is **not** an extra gate. Both students must meet all requirements for the same challenge.
- A qualifying test is a full paper or an agreed comparable timed section. All pages/fragments of the same paper belong to one test. Host checks evidence and the journal before approving; duplicate uploads are not extra tests. This is a human quality check, not automatic semantic duplicate detection.
- Pending/rejected tests earn no points. Corrections retain the test identity, number, taken date and challenge allocation. An old test cannot move into another challenge. Approval after its challenge closes affects academic history, not the frozen reward snapshot or new challenge.
- Extra papers remain in graphs/history/averages. Lower marks can reduce averages; missed due tasks can reduce the task ratio. The UI calls this a **Challenge score**, not a ranking of effort. There is no leaderboard or expiry at day 30.

## Optional feedback

The **Sounds on/off** and **Animations on/off** buttons sit above the three pages. Sounds default to off. Preferences are remembered on that browser/device; they are independent. System reduced-motion preference always suppresses animation even when the app animation toggle is on.

Original Web Audio sine-tone phrases last under a second and require a user interaction before creating/resuming audio. New playback stops the previous phrase; there is no download, loop or background music. If audio is unsupported/blocked, the visual/text confirmation remains.

Task completion, future-plan saves and test submission produce feedback only after the backend confirms the operation. Submission says **Submitted — awaiting approval**, never approved. Optimistic task updates do not emit success feedback. Undo uses the normal saved state without a celebration. Failed/offline writes retain errors and task rollback.

Device-local receipt identities suppress repeated effects from retries, double clicks and refreshes. Realtime events only refresh data and never invoke ordinary success feedback, including changes by the other student. Demo task changes do not emit a real-save celebration. Movie achievements persist in history and are discovered silently; **Celebrate** explicitly starts the brief character meeting and optional sound once per reward/device. Clearing browser storage clears local preferences/receipts, not study data or rewards.

## Verify and publish

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e`. For installed Edge on Windows, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'`; `npm run test:e2e -- --workers=1 --timeout=60000` reduces browser contention on slower PCs. The tests use an isolated embedded database or mocks/sample data; they do not modify your hosted project.

After applying the new SQL, sign in privately as Host and verify preview/save, then as each student to check own-task completion, submission pending state, approval updating the score and second-device live refresh. Verify an existing v1 challenge still has its previous formula. Check sounds off by default, on/off persistence, reduced motion, offline failure, undo and silent reload of a reward. Use a separate staging project for synthetic qualifying data and simultaneous-client reward races; do not rewrite production study history to force a reward.

Push the changed source **including the new migration** to your existing GitHub repository, then let the existing GitHub Actions Pages workflow build/deploy. Keep its current public Supabase variables and repository base path. The frontend workflow does not apply hosted SQL. Use the existing three bookmark links. Only call the online update verified after opening the deployed URL and testing it.

Observed local and hosted-check results are recorded in [VERIFICATION.md](VERIFICATION.md). The new migration was not applied to the hosted database by this coding session.
