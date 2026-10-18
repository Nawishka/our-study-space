# Our Study Space

**Appearance and audio update:** [Studio themes and verification](docs/UI-REVIEW.md). Warm cream light mode, full dark mode, aligned notifications and original study companions. Turn **Sounds on**, then choose **Test sound** to check device playback. No new migration or account setup is required for this visual/audio update.

**Latest update:** [Notifications, missed-task deductions and Host points](docs/NOTIFICATIONS-AND-POINTS-UPDATE.md). This existing database needs only `202610170005_notifications_and_points.sql`; migration 004 is already applied. New-challenge defaults are 70 task / 25 practice / 5 performance.

**For this existing installation, follow [START-HERE.md](START-HERE.md).** Existing Supabase public configuration and the GitHub repository are already connected. Fresh-install instructions below are reference only.

A private study studio for Melan, Shashi and a separate host. Three pages: **Daily Focus**, **Academic Growth**, **Our Journey**. React + TypeScript + Vite + Tailwind; Supabase Auth, PostgreSQL, private Storage, Realtime and Cron; GitHub Pages frontend.

**Verification boundary:** hosted Supabase Auth responds and public signup remains disabled. The new notifications table was absent in the read-only check on 18 October 2026. Apply the new migration separately; frontend deployment does not update SQL. Authenticated hosted workflows still require account-owner verification. Demo mode is explicit and isolated.

## 1. Run it on your Windows PC

Install Node.js **22.12+** (or current supported Node LTS) with npm, and Git. Open a terminal in this folder:

```powershell
npm install
npm run connect
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`). Before Supabase is configured, it shows the setup/sign-in screen. The normal login screen contains no demo link. For development only, explicitly opening `?demo=1#/daily` loads sample data. Demo task changes stay only in that browser tab and disappear on reload. Demo uploads, settings and plan saves explicitly refuse to claim success. Sample dates follow the current Colombo day; no exam date is invented.

To run checks:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

If Edge is already installed and a test-browser download is unavailable:

```powershell
$env:PLAYWRIGHT_CHANNEL = "msedge"
npm run test:e2e
```

Only one package manager is needed. `package-lock.json` is the deployment source of truth. The application uses no service worker, offline fake saves, or browser-local production database.

## 2. Create and configure Supabase

1. Create a Supabase project in your own account. Keep its database password private.
2. In the **SQL Editor**, run `supabase/migrations/202610120001_study_space.sql`, then the remaining numbered migrations through `202610170005_notifications_and_points.sql`, in order (fresh installations only). These are versioned one-time migrations; do not paste them repeatedly into an already migrated database. They run from a clean project. With the CLI, `supabase link --project-ref YOUR_PROJECT_REF` then `supabase db push` tracks which migrations were applied.
3. In **Storage**, confirm `test-proofs` exists, is **private**, limits files to **10 MB**, and allows only JPEG/PNG/WebP/PDF. Policies are installed by the migration.
4. In **Database → Replication / Realtime**, confirm `tasks`, `task_days`, `tests`, `settings`, `challenges`, and `rewards` belong to the `supabase_realtime` publication. The migration adds these. No presence channel is used.
5. In **Integrations / Cron**, confirm `study-midnight` runs at `30 18 * * *` UTC, which is midnight in Sri Lanka. Inspect `cron.job_run_details` after a run. If your project requires enabling Cron first, enable it and then apply the second migration. The authenticated catch-up routine also repairs missed days every minute while the app is open, on reconnect and on initial loading.
6. Get the **Project URL** and **publishable key** from Supabase's connection/API settings. The legacy `anon` public key can also work, but prefer a publishable key. Put only these public values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_BASE_PATH=/
```

Restart Vite after editing environment variables. Never use `service_role`, a secret API key, database password or personal access token in a `VITE_` variable, public CI logs, chat, or source code. This app's backend uses database functions and does not need a service-role key at runtime.

Supabase's primary documentation: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access](https://supabase.com/docs/guides/storage/security/access-control), [password authentication](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

## 3. Set up username-and-password accounts

**Login now uses host, melan and shashi with separate passwords.** There is no email signup, code verification, email recovery or SMTP setup. Follow [the password setup guide](docs/PASSWORD-SETUP.md).

In Supabase, keep the Email/password provider enabled as the underlying password backend and public signup disabled. The app maps each username to the owner's existing confirmed account using `shared/accounts.json`; users do not enter an email or receive a code. Keep sign-in rate limits enabled.

**Current installation: you report that the three profile mappings are configured. Do not recreate them or run account setup again as a routine connection step.** Connect `.env.local` with the Project URL and publishable key, then sign in with the existing account passwords. Live password sign-in still needs verification. The operator tool below is only for new provisioning or an intentional password reset.

Run this locally in an interactive terminal:

```powershell
node scripts/manage-accounts.mjs
```

It prompts securely for the project URL, operator key and each chosen password. It creates admin-confirmed Auth accounts and profile mappings. Existing mapped users retain their UUIDs, so all study records and role permissions are preserved. No default password or privileged key is included. Do not run the manual provision.sql script after using this tool.

For an owner-assisted password reset without email, use `node scripts/manage-accounts.mjs --role melan` (or `host` / `shashi`). Credentials belong only in your terminal/password manager, never source code or chat.

Sign in as each account and check the normal role restrictions. A username or URL hint cannot grant a role. The authenticated Auth UUID must have the corresponding protected profile mapping. Password sign-in is a direct API exchange and does not require auth callback routes.

## 4. Set the actual exam date and start the challenge

Sign in as **Host**, open **Our Journey → Host settings & challenge controls**. Enter the actual shared A/L examination starting date, check the default scoring values, and save. No date is seeded or guessed.

After migration 005, new-challenge defaults are 70 task points + 25 approved-practice points + 5 equal-subject performance points. The practice target is two approved papers per subject. Qualify at 85 points, 20 active study days, 80% on-time tasks, and at least one approved test in all three assigned subjects; the practice target is not an extra gate. Existing v1 challenges retain their original task/test formula. Click **Activate the first challenge** only if none is already active. Activation is idempotent. Earned rewards automatically archive the old challenge and create the next one.

Exam-date changes take effect immediately. Scoring-setting changes are audited and apply to the **next** challenge; active weights are frozen. Migration 005 adds an audited one-point missed-deadline deduction prospectively; see the update guide for the effective date. Tasks are planned for tomorrow or later; due/current/past obligations cannot be casually deleted or rescheduled to repair a score.

Subjects are seeded as Melan: ET/SFT/ICT; Shashi: Biology/Chemistry/Physics. A test number is reserved when a draft is saved. Abandoned drafts may leave sequence gaps; numbers are never reused. A rejected correction retains its number and original challenge allocation. Drafts are visible to their owner and host.

See [architecture](docs/ARCHITECTURE.md) for precise denominator, active-day, eligibility, late-approval, rollover and reset rules.

## 5. Push to GitHub and deploy Pages

This installation uses `Nawishka/our-study-space`, with existing public Supabase repository variables. Keep them. The following repository creation example is only for a fresh installation. A private repository's Pages availability depends on your GitHub plan. The static frontend itself can be publicly downloadable; private study data is protected by Supabase authentication/RLS.

From this folder, after checking that no `.env.local` or secrets are staged:

```powershell
git add .
git commit -m "Build Our Study Space"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

If a remote already exists, inspect `git remote -v` rather than adding a second one. GitHub may request authentication through your credential manager; never paste a personal access token into a repository file.

In the GitHub repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public client configuration, not privileged credentials.
3. The `Verify and deploy to GitHub Pages` workflow installs from the lockfile, typechecks, lints, runs PostgreSQL/unit/component tests and browser tests, builds with `base: /REPOSITORY/`, then deploys. Missing production configuration intentionally blocks deployment. Pull requests run verification without deploying.
4. A separate `Supabase migration and policy smoke tests` workflow starts local Supabase in Docker, applies migrations and runs pgTAP, including the Cron schedule check. Confirm both workflows are green before sharing the app.
5. Open the Pages URL returned by the successful deployment, confirm a normal sign-in screen, and verify each role. Only then consider it live.

The three convenient bookmarks are:

```text
https://USERNAME.github.io/REPOSITORY/?view=host#/daily
https://USERNAME.github.io/REPOSITORY/?view=melan#/daily
https://USERNAME.github.io/REPOSITORY/?view=shashi#/daily
```

These are **view hints only**. A verified identity that differs from the hint gets a safe redirect screen; typing `view=host` grants nothing. Routes are hashes (`#/daily`, `#/academic`, `#/journey`), so project-subpath refreshes do not need a server rewrite.

For a root user site or custom domain, change the workflow's `VITE_BASE_PATH` to `/`. Password login does not use email redirects or auth callback routes. For a project site, keep the automatic repository-name base. The workflow does not deploy the database; new installations must apply migrations separately. Your existing configured database does not need to be recreated.

To test a project-subpath build locally:

```powershell
$env:VITE_BASE_PATH = "/our-study-space/"
npm run build
$env:E2E_PREVIEW = "1"
$env:E2E_BASE_PATH = "/our-study-space/"
npm run test:e2e
```

Use a build without production Supabase environment values for the included deterministic demo/browser tests. Real Auth/Storage verification is a separate staging step.

## 6. Production acceptance and troubleshooting

Run the [production checklist](docs/VERIFICATION.md) with all three accounts. Use a separate test Supabase project for synthetic scores and reward tests; do not edit production dates or thresholds just to simulate success.

| Symptom                                 | Check                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| “Setup needed”                          | Public env variables are present at build time; rebuild/restart after changes.                                                      |
| Incorrect username/password             | Use host, melan or shashi and the existing password. Check shared/accounts.json against the existing Auth account. Use owner-assisted reset only if needed. |
| Signed in but no access                 | The Auth UUID must match profiles.id. Use the setup tool to create the missing mapping.                                             |
| Another-role bookmark                   | Continue to your authenticated role, or sign out and sign in with the correct username/password.                                    |
| New day looks stale                     | Network/realtime status; catch-up runs at most 60 seconds later; inspect `cron.job_run_details` and database logs.                  |
| Upload rejected                         | Supported format, nonempty file, ≤10 MB, private bucket policies applied, test is an owned draft. Retry keeps the draft/number.     |
| Proof link expired                      | Press “Open private proof” again; links last only 60 seconds.                                                                       |
| No graph after upload                   | Only approved tests appear. Host must review the private evidence.                                                                  |
| Score lower than yesterday              | New missed obligations can lower the ratio. Carryovers are never counted twice.                                                     |
| New settings do not change active score | Intended: existing challenge uses frozen rules; new rules begin next challenge.                                                     |
| Pages asset 404                         | Repository-name `base` and trailing slash; avoid a custom domain/root mismatch.                                                     |
| Unexpected save failure                 | Keep the form open, reconnect, read the error and retry. No write is silently queued offline.                                       |

For SQL/policy smoke tests on your own PC, install Docker Desktop and the Supabase CLI, then run `supabase start` and `supabase test db`. The embedded PostgreSQL tests in `npm test` do not require Docker or external accounts. They exercise the actual application migration with minimal Auth/Storage schema adapters; they do **not** prove hosted password sign-in, Storage HTTP validation, Realtime transport or Cron scheduling.

## Maintenance and handoff

- Back up PostgreSQL **and Storage objects** using the project/account backup tools. A database backup alone does not preserve uploaded papers.
- `audit_log` records task changes, submissions, corrections, reviews, settings and challenge unlocks. Host can read it in SQL Editor; students only see their own actor records through RLS.
- `scripts/cleanup-evidence.mjs` is an operator-only dry-run utility for unreferenced draft uploads older than seven days. Read its comments and the architecture note before `--apply`; do not run deletion while submissions are active. Credentials belong only in the operator's environment. No automatic deletion of approved evidence is configured.
- Keep Supabase signup disabled and review new migrations, dependency updates, password recovery, backups and database logs periodically.
- Source: `src/` app; `supabase/migrations/` schema/policies/RPCs; `tests/` executable checks; `.github/workflows/` CI/Pages; `docs/` decisions and acceptance.

**Remaining database step:** apply only migration 005 as described in [the update guide](docs/NOTIFICATIONS-AND-POINTS-UPDATE.md). Keep existing credentials and public configuration. Verify real sign-in and authenticated actions privately; no password or privileged key needs to be shared in chat.
