# Our Study Space — existing installation

Your repository is [Nawishka/our-study-space](https://github.com/Nawishka/our-study-space). The published address is [Our Study Space](https://nawishka.github.io/our-study-space/) after a successful Pages deployment. Keep the existing Supabase connection values, users, passwords and role mappings.

## Enable the latest features

1. You already applied migration 004. Open [202610170005_notifications_and_points.sql](supabase/migrations/202610170005_notifications_and_points.sql).
2. Copy its complete contents into a **new SQL Editor snippet** in the existing Supabase project. Click **Run** once and wait for success.
3. Refresh the app and sign in using **host**, **melan** or **shashi** and the existing password. No email codes, signup or SMTP.
4. Open **Notifications**. Host sees all students and can filter. Students see only their own notices.
5. Host can open **Our Journey → Host · Add challenge points**. Review the [points and notification rules](docs/NOTIFICATIONS-AND-POINTS-UPDATE.md) before using it.

Do not rerun migrations 001–004 or recreate accounts. GitHub deployment cannot run this SQL for you. No passwords or private keys belong in chat.

## Publish future updates

Use the existing repository and main branch. Commit and push the intended source changes. The existing **Verify and deploy to GitHub Pages** workflow checks and publishes the app. **Supabase migration and policy smoke tests** checks a separate disposable local database in CI; it does not update your hosted data.

If Pages was intentionally unpublished, restore **Settings → Pages → Source: GitHub Actions** and enable the deploy workflow, then run it on main. Keep both existing public Supabase repository variables unchanged. Do not add a second repository or upload dist manually.

Confirm both workflows succeed and open the normal sign-in page before sharing the URL. The three bookmarks are:

- [Host](https://nawishka.github.io/our-study-space/?view=host#/daily)
- [Melan](https://nawishka.github.io/our-study-space/?view=melan#/daily)
- [Shashi](https://nawishka.github.io/our-study-space/?view=shashi#/daily)

Bookmarks are only view hints. The backend-verified account determines permissions.

## Check real use privately

Sign in with the existing accounts. Confirm tasks save after refresh, a submitted paper stays pending until Host approval, rejected papers show a red notice, and read status is separate for Host and student. Check live updates on a second device. A demo preview and automated tests do not prove hosted sign-in, uploads, Realtime or Cron execution.

For local development, run npm install then npm run dev in this folder. The existing .env.local is already configured and must remain untracked. Use the normal address without ?demo=1 for real work.

You own the repository, Supabase data and full source. See [README](README.md) for the technical reference and [password recovery](docs/PASSWORD-SETUP.md) only if a password needs an intentional private reset.
