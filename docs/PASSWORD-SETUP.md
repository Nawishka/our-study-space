# Switch to username and password

Users enter **host**, **melan** or **shashi** and their existing account password. No email signup, verification codes or SMTP are needed. Supabase validates the password and issues the same signed sessions used by the existing RLS rules. The already applied SQL migrations and midnight job do **not** need to be rerun.

Supabase's built-in password endpoint accepts an email-shaped identifier rather than a username. `shared/accounts.json` now maps usernames to the three existing accounts confirmed by the owner. The stored addresses are account identifiers only; login does not send mail. These mappings are public client configuration, never credentials or permission grants.

**For this existing installation: skip account creation/migration below.** All three Auth accounts and profile roles were already created and confirmed in the dashboard. Keep their UUIDs and passwords. The next required step is the Project URL and publishable key in `.env.local`, followed by testing real sign-in. Use the operator tool only if an actual password reset is needed.

## 1. Set Supabase Auth options

Open **Authentication → Sign In / Providers** (some dashboard layouts call this Providers).

- Keep the **Email/password provider enabled**: it is the underlying password backend, not an email delivery requirement.
- Turn **Allow new users to sign up OFF**. Keep anonymous sign-in and unused social providers off.
- Turn **Confirm email OFF**. Accounts are created and confirmed by the project owner, not through a public signup or an emailed link.
- Set minimum password length to **12**, and require uppercase, lowercase, numbers and symbols. Keep Auth sign-in rate limits enabled. If available on your plan, enable leaked-password protection.
- No custom SMTP, magic-link template, invite email, reset email or email security notification is needed. Leave optional email notifications disabled. Do not use “Invite user” or “Send password recovery.”

The equivalent local CLI defaults are in `supabase/config.toml`. That file does not automatically change hosted dashboard settings.

## 2. Create or migrate the accounts

Optional for a new installation or an intentional password reset: open an **interactive PowerShell/Terminal window in the project folder**, then run:

```powershell
node scripts/manage-accounts.mjs
```

The tool asks for your project URL, then the project's server secret/legacy service-role key in a **masked prompt**. Enter this key only in your own terminal. It is used temporarily by the operator tool, never included in the browser app, written to a file, or printed. Do not paste it into chat or `.env.local`. Your client `.env.local` still contains only the URL and public publishable key.

Then choose and confirm a different strong password for each of `host`, `melan`, and `shashi`. Use a password manager; there are no default passwords. The tool requires at least 12 characters and at most 72 UTF-8 bytes, including uppercase, lowercase, a number and a symbol. Passwords are masked and are not printed or saved by the script. Share each student's credential privately yourself.

The tool:

1. Looks up the existing `profiles.role` mapping.
2. Updates that **same Auth UUID** with its internal identifier and password, or creates an admin-confirmed account when none is mapped.
3. Creates a missing profile mapping only; never swaps or overwrites another role's identity.
4. Preserves all existing tasks, proofs, approvals, scores and rewards because owner IDs are unchanged.
5. Stops safely on an identifier/role conflict. An interrupted profile creation can be repaired by rerunning the tool; it reuses the already-created account. Rerunning also resets the passwords you select.

Run only one operator setup process at a time. If you already created legacy Auth users but have not mapped them to profiles, first map their UUIDs using `scripts/provision.sql` if you want to retain those particular identities. Existing mapped accounts are detected automatically. Do not delete existing users to migrate them.

### Dashboard alternative for a brand-new installation

If **no profiles exist yet**, you can use **Authentication → Users → Add user → Create new user**, with a strong password and **Auto Confirm User** enabled, for each internal identifier:

| App username | Internal Auth identifier                  | Profile role |
| ------------ | ----------------------------------------- | ------------ |
| `host`       | Value of `host` in `shared/accounts.json` | `host`       |
| `melan`      | Value of `melan` in `shared/accounts.json` | `melan`      |
| `shashi`     | Value of `shashi` in `shared/accounts.json` | `shashi`     |

Copy each new Auth UUID, replace the UUID placeholders in `scripts/provision.sql`, and run it once in SQL Editor. **Skip this manual SQL step if you used the setup tool**, which already creates the mappings. Use the operator tool for migrating existing mapped users.

## 3. Start and check the app

Use your Supabase project URL and **publishable** key in `.env.local`, then restart with `npm run dev` (or redeploy the updated frontend to GitHub Pages). Sign in using each username and its chosen password. Upper/lowercase and surrounding spaces in usernames are normalized. Passwords are case-sensitive and are never trimmed.

- No email field, signup button, code field or email recovery flow should appear.
- Wrong passwords must stay on the login screen and show a generic error.
- A student opening `?view=host` must get the role-mismatch screen after signing in, not host access.
- Student cross-owner writes, approvals and private-proof access must still be rejected by the backend.
- Refresh should keep a valid session. Sign out should return to the password form. Expiration/revocation requires signing in again.

## Password resets without email

Only the project owner with server credentials can perform account recovery. Run:

```powershell
node scripts/manage-accounts.mjs --role melan
```

Use `shashi` or `host` to reset that account instead. This preserves the same user ID and all study records. There is no public reset endpoint and no emailed link. Supabase controls token/session revocation; an already issued access token may remain valid until its expiry, so do not promise immediate invalidation of every open session.

## What stays protected

No passwords are stored in the public database schema, frontend bundle, app localStorage or repository. Supabase handles password hashing and validation. Only session tokens are remembered by the Supabase client. Roles still come from the protected `profiles` table associated with the authenticated UUID, never from the username, the internal identifier, user-editable metadata or `view=`.

References: [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [admin account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [admin account updates](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [password security](https://supabase.com/docs/guides/auth/password-security).

Local tests cover the login UI/helper, account setup using mocked admin APIs, and the unchanged PostgreSQL/RLS permissions. Creating/resetting real credentials and verifying live sign-in still require the owner to configure the hosted project. No passwords or keys have been chosen or guessed for you.
