# Data and trust boundaries

The static React app is an untrusted client. Supabase Auth verifies username-mapped password credentials and issues signed sessions; `profiles` maps exactly one verified Auth UUID to each of the three roles. There are no public table-write grants. Narrow SECURITY DEFINER RPCs have fixed empty search paths, explicit membership/ownership checks, and schema-qualified references. Only the authenticated role has RPC execution. Internal maintenance cannot be invoked by a client. URL view hints affect only the post-login entry screen.

## Tasks and calendar days

`tasks` stores one original obligation. `task_days` stores unique `(task_id, study_date)` appearances, including missed dates. All calendar boundaries are computed by PostgreSQL with `Asia/Colombo`; instants use `timestamptz`. The scheduled routine at 18:30 UTC (Colombo midnight), the authenticated catch-up RPC, and score loading share the same routine. Catch-up fills **every** missed daily appearance, even after days of inactivity. It never duplicates a task. Completion changes only today's instance. Undo is allowed only on today's completion, before its challenge is archived. Late completion counts in today's progress but not the original on-time numerator.

Tasks may be created, rescheduled, renamed or cancelled only while in the future. Cancellation is soft and audited. This deliberate restriction prevents rewriting historical obligations or shrinking a challenge denominator after missing work. Past tasks remain visible in daily history and audit records, even though the UI concentrates on today. Both students see task progress; only the owner or host can mutate it.

## Tests and private evidence

Saving a draft allocates a per-owner/per-subject number using an atomic upsert, protected by the shared transaction lock. Client-generated UUIDs are operation identities for retries. Drafts and corrections retain the number. Sequence gaps from abandoned drafts are intentional; numbers are never reused. An owner's assigned subjects are verified on the server. Draft -> pending requires at least one real Storage object, which is bound to an evidence row. Pending -> approved/rejected is host-only and audited. Editing pending/rejected returns it to draft. Taken date, owner, subject, sequence and challenge allocation cannot be changed by corrections.

Private Storage paths are `owner UUID/test UUID/random UUID.ext`. Bucket policy permits JPEG, PNG, WebP and PDF up to 10 MB; the browser checks the same limits. SVG/HTML are excluded. Owner-only draft uploads; no overwrite; private download for owner/host; 60-second signed viewing links. Referenced proof cannot be deleted by clients. Evidence is never sent to the other student, even for an approved test. Notes and titles render as React text, never HTML. MIME restrictions are not a malware scanner; the host should handle documents as untrusted files.

The cleanup utility lists old unreferenced draft uploads. It is dry-run by default. Do not run deletion concurrently with active submissions: pause operator cleanup during study activity. Storage HTTP deletes and database transactions cannot share an atomic transaction. Retained evidence and historical papers must never be removed to save space without an explicit archival policy.

## Challenge lifecycle

Migration `202610140004_scoring_v2.sql` adds versioned next-challenge settings. `private.score` dispatches through `private.score_with_rules`: missing version means the exact original v1 pooled-test formula; v2 splits tasks/practice/performance and weights the three subject averages equally, using zero for missing subjects. `test_weight` is retained as the sum of practice/performance for old clients. Validated weights total 100. Migration 004 leaves active/archived challenge JSON unchanged. Migration 005 adds only a prospective, audited missed-deadline rule to the active challenge; archives remain unchanged. The host-only stable `preview_challenge_scores` function computes against proposed rules without maintenance or writes. See [the upgrade guide](SCORING-AND-FEEDBACK-UPDATE.md) for formulas and transition details.

A transaction-scoped advisory lock orders every task/approval/lifecycle mutation. An active challenge is unique by partial index. Due tasks receive their challenge ID once. Plans enter the denominator only once due; old obligations remain with their old challenge. Eligible tests receive their challenge ID when first saved, provided their test date is not before the active challenge's local start date. Pending tests do not count. Late approvals of archived challenge tests appear in the academic graph but cannot change archived scores or enter the next challenge.

The score function computes full-precision numeric components. Both students need the configured score, active days, on-time percentage and all three subjects. No eligibility depends on rounded display numbers. All passed: archive exact rules, timestamps, elapsed local days and score/subject snapshots; insert a reward with a unique challenge ID; create the next active challenge. These steps run in one transaction. Retrying cannot create a second reward. Newly active scores are zero because earlier tasks/tests keep their challenge IDs. Host settings are versioned through audit records and frozen into each challenge at activation; edits affect the next challenge. There is no expiry and no destructive reset button.

## Realtime and recovery

Authenticated Postgres Changes subscriptions respect table SELECT policies; there are no presence or status channels. Clients debounce events and replace data with a fresh snapshot, preventing duplicate events from duplicating rows. Reconnect/focus events and a 60-second catch-up refresh repair missed notifications and trigger day rollover while a tab stays open. Identity changes hide the prior user's cached dataset. Failed task mutations restore optimistic state and display a retryable error. Draft test ID and successfully uploaded paths survive a retry in the open form; persisted draft records permit resuming after reload. Forms are never silently treated as successful offline.

## Localization and accessibility

All calendar formatting is centralized in `src/domain.ts` and `Clock`; English is the current locale. Route labels and identity names are stable internal IDs separate from display names. A future localization pass can move English presentation strings into message catalogs without changing database values or scheduling. Native labelled forms, details controls, keyboard focus, numerical chart alternatives, reduced motion, and 44px primary touch targets are included. No online/currently-studying indicators exist.

## Username/password authentication

Usernames host, melan and shashi map to the existing Supabase account identifiers in shared/accounts.json. These identifiers are included in the public client bundle; they are not credentials and only locate accounts. Native Supabase signInWithPassword validates passwords; protected profiles and auth.uid() still determine every permission. No password comparison, role assignment, signup, OTP or email recovery takes place in the frontend. URL token detection is disabled. Passwords are kept only in transient form state and cleared on success; the SDK remembers session tokens. Invalid credentials use a generic error, and backend rate limits are respected.

The operator-only manage-accounts tool uses the Auth Admin API with admin confirmation and no email delivery. It updates existing mapped UUIDs in place, refuses role/identifier collisions, and safely recovers an Auth creation followed by a failed profile insert. Credentials are entered in masked terminal prompts; no privileged runtime key is required by the frontend. See PASSWORD-SETUP.md for configuration and recovery.

## Notifications and manual points

Migration 005 wraps the frozen-rule calculator with once-per-original-task penalties and audited per-challenge positive Host adjustments, then clamps the result to 0–100. The existing eligibility gates and shared transaction lock still control reward/archive/reset. Notification event keys deduplicate carryovers and review events; score revisions detect full-precision changes. Separate per-reader receipts preserve privacy. Public new tables use SELECT-only RLS; all writes go through authorized RPCs or private functions. See [the update guide](NOTIFICATIONS-AND-POINTS-UPDATE.md) for effective dates, formula and deployment instructions.
