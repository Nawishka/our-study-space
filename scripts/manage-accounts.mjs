// Run locally: node scripts/manage-accounts.mjs [--role host|melan|shashi]
// No passwords/keys in command arguments, source files or public CI.
import { createClient } from "@supabase/supabase-js";
import { createInterface, emitKeypressEvents } from "node:readline";
import process from "node:process";
import { URL } from "node:url";
import console from "node:console";
import { provisionAccount, validatePassword } from "./lib/accounts.mjs";

async function textPrompt(prompt) {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await new Promise((resolve) => terminal.question(prompt, resolve));
  } finally {
    terminal.close();
  }
}
async function secretPrompt(prompt) {
  if (!process.stdin.isTTY)
    throw new Error(
      "Run this script in an interactive terminal so secrets can be entered without echoing.",
    );
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      process.stdin.off("keypress", pressed);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const pressed = (str, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }
      if (key.name === "return") {
        cleanup();
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        if (value) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      if (
        str &&
        !key.ctrl &&
        !key.meta &&
        [...str].every(
          (c) => c.codePointAt(0) >= 32 && c.codePointAt(0) !== 127,
        )
      ) {
        value += str;
        process.stdout.write("*".repeat([...str].length));
      }
    };
    process.stdin.on("keypress", pressed);
  });
}

try {
  const args = process.argv.slice(2);
  if (
    args.length &&
    (args.length !== 2 ||
      args[0] !== "--role" ||
      !["host", "melan", "shashi"].includes(args[1]))
  )
    throw new Error(
      "Usage: node scripts/manage-accounts.mjs [--role host|melan|shashi]",
    );
  const roles = args.length ? [args[1]] : ["host", "melan", "shashi"];
  const url = (
    process.env.SUPABASE_URL ?? (await textPrompt("Supabase project URL: "))
  ).trim();
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(parsed.hostname)
    )
  )
    throw new Error("Use HTTPS for a hosted Supabase project.");
  console.log(
    "Creates or resets the selected accounts. Existing profile IDs and study records are preserved.",
  );
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (await secretPrompt(
      "Supabase server secret/service-role key (hidden, used only here): ",
    ));
  if (!key || key.startsWith("sb_publishable_"))
    throw new Error(
      "Use an operator/server key here, not the public client key.",
    );
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  for (const username of roles) {
    let password = await secretPrompt(`New password for ${username}: `);
    validatePassword(password);
    const confirm = await secretPrompt(`Repeat password for ${username}: `);
    if (password !== confirm)
      throw new Error("Passwords did not match. Rerun to try again.");
    const result = await provisionAccount(client, username, password);
    password = "";
    console.log(`Ready: ${result.username} (${result.id}).`);
  }
  console.log(
    "Done. Keep these passwords in your password manager. No email or verification-code step is needed.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Account setup failed.",
  );
  process.exitCode = 1;
} finally {
  process.stdin.pause();
}
