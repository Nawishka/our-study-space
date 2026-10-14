# Verification and production acceptance

## Scoring/feedback update — 14 October 2026

- TypeScript typecheck and ESLint passed.
- **51 Vitest tests + 9 Node tests (60 total) passed.** The embedded PostgreSQL suite includes an in-place upgrade with existing identities/password-hash fixtures, profiles, tasks, test/proof rows, archived challenge JSON and a reward. Before/after data and legacy scores match. It exercises equal-subject weighting, mixed maxima, missing subjects, caps, pending/rejected exclusion, correction identity, validation/authorization, read-only previews, version transition, late approval, repeated reward/reset and retained archives. This is an isolated PGlite database with minimal Auth/Storage adapters, not the hosted database.
- Mocked UI tests verify success only after confirmed saves, no success on failure/offline/undo, once-only task/plan/submission feedback, duplicate Realtime events, persistent independent preferences, reduced motion and silent reward discovery with explicit celebration. Web Audio tests cover gesture initialization, brief generated phrases, replacement of previous playback and unsupported-browser fallback.
- **15 Playwright checks passed** in Edge at 375×812, 768×1024 and 1440×1000. They cover the three pages, new score breakdown/Host preview, invalid weights, preference persistence, reduced motion, overflow, navigation, completion/undo, login controls and automated axe accessibility. Phone and desktop scoring screenshots were visually reviewed. Browser data checks use explicit demo fixtures, not real study accounts.
- The production build passed. The normal local preview returned HTTP 200 and the updated journey preview is explicitly labelled as demo/sample data.
- Read-only calls using the existing public configuration reached the actual Supabase Auth service: HTTP 200, password provider enabled, public signup disabled. The new `preview_challenge_scores` RPC returned PGRST202/404 (not installed). **The hosted migration and online frontend were not updated by this session.** No account passwords or privileged keys were requested or used. Authenticated hosted workflows, physical iPhone audio, and simultaneous-client hosted reward races remain unverified.
- Apply only [202610140004_scoring_v2.sql](../supabase/migrations/202610140004_scoring_v2.sql), then deploy the frontend through the existing repository workflow. Follow [the upgrade guide](SCORING-AND-FEEDBACK-UPDATE.md). The full-Supabase pgTAP smoke test was added but has not run against a hosted/local full Supabase service here.

The older results below describe the earlier handoff, before the public connection was configured.

## Executed locally on 12 October 2026

Latest handoff check: TypeScript, ESLint and the production build passed. **34 Vitest + 9 Node tests (43 total)** passed, including rejection of server-secret/service-role frontend configuration. The responsive Edge run passed 10/12 checks initially; two tablet checks timed out during screenshot/axe work with three workers. Both passed when rerun with one worker (17.7 seconds for the two). Thus all 12 browser scenarios passed across the initial run and targeted rerun. These are local login-screen/demo checks, not authenticated hosted-service tests. The normal, non-demo preview returned HTTP 200 at `http://127.0.0.1:5173/`. No Supabase connection could be verified because its public configuration is still missing.

- `npm install`: passed using Node 24.19 and a temporary npm 11 runtime (npm was not preinstalled on this workstation). A clean npm dependency layout and `package-lock.json` are included.
- TypeScript strict typecheck: passed.
- ESLint: passed.
- After the username/password update, **34 Vitest tests passed**: nine PostgreSQL/PGlite authorization and lifecycle tests, seven domain/date tests, two rendered task-panel tests, three reliability/privacy tests, ten username/password helper tests, and three login-form tests. **Seven operator account-setup tests also passed**, covering creation, UUID-preserving migration, interrupted-setup recovery, conflicts, weak passwords and paginated lookup. Total: **41 tests** via `npm test`.
- Playwright in installed Microsoft Edge: **12 tests passed again after the password update** across 375×812, 768×1024 and 1440×1000. Each size exercises all three pages, deep-link refresh, no horizontal overflow, completion/undo, explicit demo restrictions and view-hint access. The login now checks username/password fields, password visibility controls and the absence of email/code inputs. Automated axe WCAG A/AA checks passed on the login screen and all three pages at all three sizes.
- Production Vite build: passed; routes are code-split. The main script is about 249 kB uncompressed; academic charts load separately.
- Before the password update, built project-subpath verification at `/our-study-space/` passed **12 browser tests** against the production bundle. This update removes auth callback handling entirely; password sign-in uses a direct backend API request. The root-path production build passed again after the update.
- `npm audit`: **zero reported vulnerabilities** after updating the test runtime.
- Visual inspection: phone and desktop screenshots of Daily Focus, Academic Growth and Our Journey reviewed. Text contrast and sizing were corrected after initial axe failures.

These are observed local results, not a claim of a live production deployment or zero defects. Automated accessibility checks do not replace manual assistive-technology review.

## Database behaviors exercised

The PostgreSQL suite loads `202610120001_study_space.sql` with minimal `auth.users`, `auth.uid`, Storage schema and role adapters. It checks:

- Melan and Shashi cannot create each other's plans through RPCs; clients cannot directly write tasks, roles or approval fields; students cannot approve tests or invoke private maintenance.
- An authenticated but unprovisioned identity reads no profiles and cannot call catch-up.
- Per-subject numbering, retry identity, rejected correction keeping its number, proof requirement, other-student pending-record/proof invisibility, host proof access and approved-summary visibility.
- Assigned subjects and marks constraints.
- Three missed obligations produce three appearances per day, once, after a two-day catch-up. Late completion changes only today's snapshot. Repeated maintenance does not inflate the denominator.
- Eight of ten completions, then undo, produce eight and seven completed daily instances respectively.
- Pending tests score zero; a 40-day challenge stays active.
- Both qualifying students produce exactly one reward and archived challenge, one new active challenge, zero new scores and preserved old records on repeated maintenance calls. Frozen completions cannot be undone.
- Host settings are audited and do not change active challenge rules.
- Client optimistic rollback on server failure, refusal to pretend an offline write succeeded, and hiding cached data on identity change.

The database test is **not** a hosted-service emulator. It does not prove concurrent HTTP sessions, password sign-in, Storage byte/MIME validation, signed-URL HTTP behavior, realtime transport, the production password exchange, or scheduled cron execution. Transaction advisory locking plus unique constraints implement concurrency protection; a multi-session staging race remains part of the live acceptance checklist.

## Not executed here / external blockers

The owner reports that hosted migrations, Cron and three role mappings are configured. This workspace still has no Supabase Project URL/public key or GitHub remote, and no real password login has been observed. Docker, the Supabase CLI and a local PostgreSQL server were not installed. Therefore:

- Live password sign-in/session expiration and owner-only provisioning settings are unverified.
- Hosted Storage upload/download policy behavior, actual file-limit rejection and cross-device Realtime are unverified.
- Owner screenshots now confirm the schema script succeeded and the study-midnight Cron job is enabled in hosted Supabase. A successful scheduled execution remains unverified. The pgTAP smoke suite has not run against full Supabase locally; the separate database CI workflow runs it after pushing to GitHub.
- No GitHub Actions run, Pages publication or public URL has been verified.
- Browser checks used Windows Edge viewport emulation. Physical iPhone/Safari testing remains required before relying on it daily.

## Owner's production checklist

Use a staging Supabase project first, then repeat normal-operation checks in production.

1. Apply migrations, verify private bucket configuration and Cron, disable signup, provision the three distinct UUIDs, configure the native password provider with signup disabled and create the accounts using the masked operator setup tool (see PASSWORD-SETUP.md).
2. Sign in with all three usernames and chosen passwords; reject wrong passwords. Change `?view=melan` to `?view=host` while signed in as Melan: expect a safe mismatch screen, never host controls. Attempt a direct client table UPDATE and a cross-owner `save_task` RPC: both must fail.
3. On two separate devices, open Daily Focus. Complete/undo an owned task, check independent fractions and percentages and verify the other device updates without a manual refresh. Disconnect one device, attempt a write, reconnect and verify consistent saved state.
4. Create future plans as each student and as host. Verify only the owner's/host's changes succeed. Leave three due tasks unfinished over a Colombo midnight; check the Cron run and then call catch-up twice. Confirm exactly three postponed obligations, original due dates and unchanged missed-day history.
5. Upload a real small JPEG/PNG/WebP/PDF marked paper. Try an unsupported type, an empty file and >10 MB file. Interrupt an upload; retry from the draft. Check that no pending mark enters a graph or score. Other student must not retrieve the evidence row, Storage object or a signed proof URL.
6. Submit two tests simultaneously for the same student/subject from separate browser sessions: numbers must be distinct. Reject one, correct it and resubmit: original number stays. Approve from host and verify both devices' graph and history. Student direct approval RPC must fail.
7. In **staging only**, prepare qualifying fixtures for both students with 20 active days, qualifying ratios and approved coverage. Trigger the final task/approval concurrently from two sessions and retry. Verify one reward, one closed challenge, one new active challenge, zero new scores, preserved tasks/tests/proofs and frozen snapshots. Load Our Journey afterward and verify the persisted celebration appears. Approve an older pending test and ensure it cannot enter the new score or rewrite the archive.
8. Verify a challenge at day 31/40 remains active without expiry. Verify future plans do not count until due; completing carryovers does not improve the original on-time numerator.
9. Set the actual exam date and compare the clock/countdown at Colombo midnight, on exam day and after the date. No date should be guessed.
10. Push to GitHub, require both workflows to pass, configure Pages, open the returned live URL, refresh `#/academic` and `#/journey`, and verify password sign-in at the project subpath. Test on a physical iPhone and a Windows browser, including keyboard navigation, reduced motion and file selection.

## Operational limitations

- Scoring-settings edits intentionally affect the next challenge. Current/past task obligations cannot be renamed, moved or deleted through the planning UI. This protects historical truth.
- Test draft numbers may have gaps. Corrections keep the original subject/date/challenge and all previously submitted evidence. Old pending approvals remain attached to their original challenge.
- Failed uploads can leave private unreferenced draft files. The supplied operator cleanup tool is dry-run by default and must be used outside active submission periods. There is no destructive scheduled cleanup of historical papers.
- Storage MIME restrictions are not antivirus. No claim of malware scanning is made.
- Auth/local session security, password recovery, backups and service quotas depend on the owner's Supabase/GitHub configuration.
