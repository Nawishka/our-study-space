import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { validatePublicConfig } from "../scripts/lib/public-config.mjs";
const url = "https://example.supabase.co";
const jwt = (role) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
test("accepts public publishable and legacy anon config", () => {
  validatePublicConfig(url, "sb_publishable_example");
  validatePublicConfig(url, jwt("anon"));
});
test("rejects privileged keys and malformed configuration", () => {
  for (const key of [
    "sb_secret_example",
    jwt("service_role"),
    jwt("authenticated"),
    "YOUR_PUBLISHABLE_KEY",
    "bad\nkey",
  ])
    assert.throws(() => validatePublicConfig(url, key));
  for (const address of [
    "https://supabase.com/dashboard/project/example",
    "postgres://user:password@host/db",
    "http://example.supabase.co",
    "https://user:password@example.supabase.co",
    "https://example.supabase.co?key=value",
  ])
    assert.throws(() =>
      validatePublicConfig(address, "sb_publishable_example"),
    );
});
