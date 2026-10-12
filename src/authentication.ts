import accounts from "../shared/accounts.json";
import { supabase } from "./service";

export const INVALID_LOGIN = "Incorrect username or password.";

// These public aliases locate accounts; they are not roles, credentials, or
// proof of identity. Supabase validates passwords and issues signed sessions.
export async function signInUsername(username: string, password: string) {
  if (!supabase)
    throw new Error(
      "Supabase is not configured yet. Follow the README to connect your project.",
    );
  const normalized = username.trim().toLowerCase();
  if (!Object.hasOwn(accounts, normalized) || !password)
    throw new Error(INVALID_LOGIN);
  const { error } = await supabase.auth.signInWithPassword({
    email: accounts[normalized as keyof typeof accounts],
    password, // Do not trim passwords or persist them in application storage.
  });
  if (!error) return;
  if (error.status === 429)
    throw new Error(
      "Too many sign-in attempts. Please wait before trying again.",
    );
  if (!error.status || error.status >= 500)
    throw new Error(
      "Could not reach the sign-in service. Check your connection and try again.",
    );
  throw new Error(INVALID_LOGIN);
}
