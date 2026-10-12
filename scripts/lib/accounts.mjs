// Operator-only code. This module must never be imported by the frontend.
import { Buffer } from "node:buffer";
import accounts from "../../shared/accounts.json" with { type: "json" };

export function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    ![...password].some((c) =>
      "!@#$%^&*()_+-=[]{};'\":\\|<>?,./`~".includes(c),
    ) ||
    /[\r\n\0]/.test(password)
  ) {
    throw new Error(
      "Use at least 12 characters (at most 72 UTF-8 bytes), including uppercase, lowercase, a number and a symbol.",
    );
  }
}

async function findAlias(client, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error)
      throw new Error(
        "Could not read Auth users. Check the operator key and project URL.",
      );
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
}

export async function provisionAccount(client, username, password) {
  if (!Object.hasOwn(accounts, username))
    throw new Error("Unknown account. Use host, melan or shashi.");
  validatePassword(password);
  const email = accounts[username];
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role")
    .eq("role", username)
    .maybeSingle();
  if (profileError)
    throw new Error(
      "Could not read profiles. Apply the study-space migration first and check the operator key.",
    );
  const aliasUser = await findAlias(client, email);
  if (profile && aliasUser && profile.id !== aliasUser.id)
    throw new Error(
      "Account identifier conflict. No changes made; resolve the duplicate Auth user before retrying.",
    );
  let id = profile?.id ?? aliasUser?.id;
  if (id) {
    // Never repoint an existing profile to a different identity. Preserve all
    // task owners, private evidence paths, approvals and historical records.
    const { data: bound, error } = await client
      .from("profiles")
      .select("id,role")
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw new Error("Could not verify the existing account mapping.");
    if (bound && bound.role !== username)
      throw new Error(
        "This identity already has another role. No changes made.",
      );
    const result = await client.auth.admin.updateUserById(id, {
      email,
      password,
      email_confirm: true,
    });
    if (result.error)
      throw new Error(
        "Account update failed. Check Supabase Auth logs without sharing passwords or keys.",
      );
  } else {
    const result = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (result.error || !result.data.user)
      throw new Error(
        "Account creation failed. Check Supabase Auth logs without sharing passwords or keys.",
      );
    id = result.data.user.id;
  }
  if (!profile) {
    const { error } = await client.from("profiles").insert({
      id,
      role: username,
      display_name: username[0].toUpperCase() + username.slice(1),
    });
    if (error)
      throw new Error(
        "Auth account saved but profile creation failed. Rerun this command to safely recover; do not delete an existing identity.",
      );
  }
  // Passwords and privileged credentials are deliberately never returned.
  return { id, username };
}
