import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock("../src/service", () => ({ supabase: { auth } }));
import { INVALID_LOGIN, signInUsername } from "../src/authentication";
import accounts from "../shared/accounts.json";
beforeEach(() => {
  vi.clearAllMocks();
  auth.signInWithPassword.mockResolvedValue({ error: null });
});
it.each(["host", "melan", "shashi"] as const)(
  "authenticates %s using the backend password endpoint",
  async (username) => {
    await signInUsername(
      ` ${username.toUpperCase()} `,
      "  Untrimmed-password9!  ",
    );
    expect(auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: accounts[username],
      password: "  Untrimmed-password9!  ",
    });
  },
);
it.each([
  "administrator",
  "__proto__",
  "host@accounts.our-study-space.invalid",
  "",
])(
  "rejects invalid username %s without constructing an arbitrary address",
  async (username) => {
    await expect(signInUsername(username, "password")).rejects.toThrow(
      INVALID_LOGIN,
    );
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  },
);
it("does not treat a recognized host username as valid credentials", async () => {
  auth.signInWithPassword.mockResolvedValue({
    error: { status: 400, message: "Invalid login credentials" },
  });
  await expect(signInUsername("host", "incorrect")).rejects.toThrow(
    INVALID_LOGIN,
  );
});
it("reports backend throttling without retrying or bypassing it", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { status: 429 } });
  await expect(signInUsername("melan", "example")).rejects.toThrow("Too many");
  expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
});
it("handles network errors without claiming sign-in succeeded", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { status: 0 } });
  await expect(signInUsername("shashi", "example")).rejects.toThrow(
    "Check your connection",
  );
});
