// Public connection settings only. Never enter passwords or server keys here.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import process from "node:process";
import console from "node:console";
import { writeFile, access } from "node:fs/promises";
import { URL } from "node:url";
import { validatePublicConfig } from "./lib/public-config.mjs";

const terminal = createInterface({ input: stdin, output: stdout });
try {
  console.log(
    "Supabase → your project → Connect → App Frameworks. Copy the Project URL and publishable key. No password or server key is needed.",
  );
  const url = (await terminal.question("Project URL: ")).trim();
  const key = (
    await terminal.question("Publishable key (or legacy anon key): ")
  ).trim();
  validatePublicConfig(url, key);
  const response = await globalThis.fetch(
    `${url.replace(/\/$/, "")}/auth/v1/settings`,
    {
      headers: { apikey: key },
      signal: globalThis.AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Supabase rejected the connection (HTTP ${response.status}). Recheck the public URL and key.`,
    );
  const settings = await response.json();
  if (!settings.external?.email)
    throw new Error(
      "Enable the native Email/password provider in Supabase Authentication. The app uses passwords only; no messages are sent.",
    );
  if (!settings.disable_signup)
    throw new Error(
      "Turn off 'Allow new users to sign up' in Supabase Authentication, then run this again. These three accounts must remain private.",
    );
  const file = new URL("../.env.local", import.meta.url);
  let exists = false;
  try {
    await access(file);
    exists = true;
  } catch {
    /* New configuration. */
  }
  if (
    exists &&
    (
      await terminal.question(
        "Replace existing local connection settings? Type yes: ",
      )
    ).trim() !== "yes"
  )
    throw new Error("Cancelled; existing configuration unchanged.");
  await writeFile(
    file,
    `VITE_SUPABASE_URL=${url.replace(/\/$/, "")}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\nVITE_BASE_PATH=/\n`,
    { mode: 0o600 },
  );
  console.log(
    "Connected to the real Supabase Auth service. Saved public configuration to .env.local. Run npm run dev and sign in privately to verify your account and study data. No account login or database write has been tested by this connection check.",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Connection failed.");
  process.exitCode = 1;
} finally {
  terminal.close();
}
