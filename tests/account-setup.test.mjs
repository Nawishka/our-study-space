import { test } from "node:test";
import assert from "node:assert/strict";
import {
  provisionAccount,
  validatePassword,
} from "../scripts/lib/accounts.mjs";
import accounts from "../shared/accounts.json" with { type: "json" };
const password = "Test-only-strong9!";
function backend({ profiles = [], users = [], failInsert = false } = {}) {
  const state = {
    profiles: [...profiles],
    users: [...users],
    created: 0,
    updated: [],
    failInsert,
  };
  const client = {
    from: () => ({
      select: () => ({
        eq: (field, value) => ({
          maybeSingle: async () => ({
            data: state.profiles.find((p) => p[field] === value) ?? null,
            error: null,
          }),
        }),
      }),
      insert: async (row) => {
        if (state.failInsert) {
          state.failInsert = false;
          return { error: { message: "unavailable" } };
        }
        state.profiles.push(row);
        return { error: null };
      },
    }),
    auth: {
      admin: {
        listUsers: async ({ page, perPage }) => ({
          data: {
            users: state.users.slice((page - 1) * perPage, page * perPage),
          },
          error: null,
        }),
        createUser: async (fields) => {
          state.created++;
          const user = { id: `new-${state.created}`, ...fields };
          state.users.push(user);
          return { data: { user }, error: null };
        },
        updateUserById: async (id, fields) => {
          state.updated.push(id);
          const user = state.users.find((u) => u.id === id);
          if (!user) return { error: { message: "not found" } };
          Object.assign(user, fields);
          return { data: { user }, error: null };
        },
      },
    },
  };
  return { client, state };
}
test("operator creates confirmed password accounts and role mappings without sending email", async () => {
  const { client, state } = backend();
  for (const role of ["host", "melan", "shashi"]) {
    const result = await provisionAccount(client, role, password);
    assert.equal(result.username, role);
    assert.equal(Object.hasOwn(result, "password"), false);
  }
  assert.equal(state.created, 3);
  assert.deepEqual(
    state.profiles.map((p) => p.role),
    ["host", "melan", "shashi"],
  );
  assert.ok(
    state.users.every((u) => u.email_confirm && u.password === password),
  );
});
test("migration preserves the existing Auth UUID and profile mapping", async () => {
  const old = { id: "existing-student", email: "old@example.invalid" };
  const profile = { id: old.id, role: "melan", display_name: "Melan" };
  const { client, state } = backend({ users: [old], profiles: [profile] });
  const result = await provisionAccount(client, "melan", password);
  assert.equal(result.id, old.id);
  assert.equal(state.created, 0);
  assert.deepEqual(state.profiles, [profile]);
  assert.equal(state.users[0].email, accounts.melan);
});
test("retry repairs an interrupted profile insert without creating duplicate identities", async () => {
  const { client, state } = backend({ failInsert: true });
  await assert.rejects(
    provisionAccount(client, "shashi", password),
    /safely recover/,
  );
  const result = await provisionAccount(client, "shashi", password);
  assert.equal(state.created, 1);
  assert.equal(state.profiles[0].id, result.id);
  assert.equal(state.users.length, 1);
});
test("identifier conflicts do not overwrite existing owners", async () => {
  const { client, state } = backend({
    profiles: [{ id: "old-host", role: "host" }],
    users: [{ id: "other-user", email: accounts.host }],
  });
  await assert.rejects(provisionAccount(client, "host", password), /conflict/);
  assert.equal(state.created, 0);
  assert.equal(state.updated.length, 0);
});
test("a mapped account cannot silently be reassigned to another role", async () => {
  const { client, state } = backend({
    profiles: [{ id: "student-id", role: "shashi" }],
    users: [{ id: "student-id", email: accounts.host }],
  });
  await assert.rejects(
    provisionAccount(client, "host", password),
    /another role/,
  );
  assert.equal(state.updated.length, 0);
});
test("weak passwords and unknown roles are rejected before backend writes", async () => {
  for (const weak of [
    "",
    "short9!",
    "alllowercasepassword",
    "NOLOWERCASE9!",
    "NoDigitsOrSymbols",
  ])
    assert.throws(() => validatePassword(weak));
  const { client, state } = backend();
  await assert.rejects(
    provisionAccount(client, "administrator", password),
    /Unknown/,
  );
  assert.equal(state.created, 0);
});
test("account lookup reads later pages before creating a user", async () => {
  const users = Array.from({ length: 100 }, (_, i) => ({
    id: `other-${i}`,
    email: `other-${i}@example.invalid`,
  }));
  users.push({ id: "existing-alias", email: accounts.host });
  const { client, state } = backend({ users });
  const result = await provisionAccount(client, "host", password);
  assert.equal(result.id, "existing-alias");
  assert.equal(state.created, 0);
});
