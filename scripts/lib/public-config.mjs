import { URL } from "node:url";
import { Buffer } from "node:buffer";
export function validatePublicConfig(url, key) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Enter your Supabase Project URL, starting with https://.");
  }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    url.includes("YOUR_")
  )
    throw new Error(
      "Use the HTTPS Supabase Project URL, not a dashboard link, database connection string, or URL with a path.",
    );
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  if (key?.startsWith("sb_secret_"))
    throw new Error(
      "Server secret keys cannot be used in this app. Use the public publishable key.",
    );
  try {
    const parts = key.split(".");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (
      parts.length === 3 &&
      claims.role === "anon" &&
      /^[A-Za-z0-9_.-]+$/.test(key)
    )
      return;
  } catch {
    /* Not a legacy anon key. */
  }
  throw new Error(
    "Use a public sb_publishable_ key or a legacy anon key. Privileged keys are not accepted.",
  );
}
