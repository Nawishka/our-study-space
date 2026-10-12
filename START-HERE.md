# Our Study Space — finish setup and go online

This is the short guide for **your existing installation**. You have reported that the database migrations, midnight Cron and three role mappings are configured. **Keep them. Do not recreate users or rerun the initial SQL.**

The app has exactly three pages: Daily Focus, Academic Growth and Our Journey. Login is **host**, **melan** or **shashi**, plus a password. No email field, verification code, signup or SMTP is needed. Supabase validates passwords; protected database roles determine permissions. The `view=host` bookmark cannot give a student host access.

## 1. Connect your existing Supabase project

Open your project in the [Supabase dashboard](https://supabase.com/dashboard). Click the green **Connect** button at the top. Select **App Frameworks** if it first shows a database connection string. Find **Project URL** and **Publishable key**. Alternative: Project Settings → Data API for the URL, and Project Settings → API Keys for the publishable key. Copy the key beginning `sb_publishable_` (a legacy `anon` key also works). Never use the secret/service-role key.

In a terminal in this project folder, run:

```powershell
npm install
npm run connect
npm run dev
```

The connection command asks for **only those two public values**. It checks the actual Auth service, requires public signup to be disabled, and saves `.env.local`, which Git ignores. It does not change your accounts or database. If npm is unavailable, install Node.js LTS with npm, reopen your terminal, then retry.

Open the address printed by the last command, normally **http://127.0.0.1:5173/**. Use this address without `?demo=1`. Sign in with a username and that existing account's password. Passwords are entered privately into the app, never chat.

The underlying Supabase provider is called **Email/password**; leave that provider enabled. The app uses your existing account identifier internally, so you never enter an email or receive a message. Keep **Allow new users to sign up OFF**. Already confirmed accounts do not need confirmation again. If a password fails, first check the password and that `shared/accounts.json` matches the existing account. Do not delete/recreate the user. Owner-only password recovery is in [PASSWORD-SETUP.md](docs/PASSWORD-SETUP.md).

**If you want me to connect it for you:** send only the Project URL and publishable key copied above. No password or privileged key is required for the connection.

## 2. Check the real app once

1. Sign in as Host. Open Our Journey → Host settings & challenge controls. Set your actual exam date. Activate the first challenge only if one is not already active.
2. Sign out and sign in as Melan, then Shashi. Check each sees their own editing controls and the other's shared progress. Create a future task and refresh; confirm it persists.
3. Submit a marked-paper test as a student. Approve it as Host. Confirm it appears in the approved graph. Open the app on a second device after deployment to check live updates.

The full acceptance checklist is in [VERIFICATION.md](docs/VERIFICATION.md). Local automated tests do not prove these hosted operations. A saved Cron schedule does not prove that a scheduled run has succeeded.

## 3. Publish with GitHub Pages

Create an empty GitHub repository named **our-study-space** in your own account. In a terminal in this folder, replace `YOUR_USERNAME` below with your GitHub username:

```powershell
git add .
git commit -m "Build Our Study Space"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/our-study-space.git
git push -u origin main
```

If a remote already exists, use `git remote -v` to check it rather than adding another. The `.env.local` file must remain untracked. Use GitHub's normal credential-manager login when requested.

In that GitHub repository:

1. **Settings → Secrets and variables → Actions → Variables → New repository variable.** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the same public values as step 1.
2. **Settings → Pages → Source → GitHub Actions.**
3. **Actions → Verify and deploy to GitHub Pages → Run workflow → main.** Wait for it to pass. Also check the Supabase migration/policy workflow from your push. If the first push ran before configuration was ready, run the deploy workflow again after steps 1–2.
4. Open the URL shown by the successful deployment. Refresh each page and sign in to confirm it works online. Do not call it live until this succeeds.

The workflow installs, tests, builds and uploads the frontend automatically. It sets the repository subpath. Do not upload `node_modules`, copy `dist` manually, configure SMTP, or rerun your database migrations to deploy the frontend.

Your final bookmarks will be:

```text
https://YOUR_USERNAME.github.io/our-study-space/?view=host#/daily
https://YOUR_USERNAME.github.io/our-study-space/?view=melan#/daily
https://YOUR_USERNAME.github.io/our-study-space/?view=shashi#/daily
```

## Your controls and ownership

You have the entire source in this folder, all SQL migrations, tests, and deployment workflow. Your GitHub account owns the frontend; your Supabase account owns users, database, private test files and backups. In-app Host controls both students' plans/tasks, test reviews, exam date, scoring settings and first challenge activation. Rewards automatically archive and restart challenges; historical data stays intact.

The app never requires a server-secret key in its frontend. The optional account recovery tool is only for the owner, run privately in a terminal when needed. [README.md](README.md) contains the longer technical reference.

References: [Supabase public keys](https://supabase.com/docs/guides/getting-started/api-keys), [GitHub Pages workflow setup](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
