import { createClient } from "@supabase/supabase-js";
import { studyDate, type Data, type Profile } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured =
  !!url && !!key && !url.includes("YOUR_") && !key.includes("YOUR_");
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export async function rpc(name: string, args: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function getProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const result = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data)
    throw new Error(
      "This account has not been provisioned for Our Study Space. Ask the owner to check your account mapping.",
    );
  return result.data;
}
export async function loadData(): Promise<Data> {
  if (!supabase) throw new Error("Missing Supabase configuration");
  const scores = await rpc("challenge_scores");
  let notification_error: string | undefined;
  const names = [
    "profiles",
    "subjects",
    "tasks",
    "task_days",
    "tests",
    "settings",
    "challenges",
    "rewards",
    "notifications",
    "notification_reads",
  ] as const;
  // Supabase returns at most 1,000 rows by default. Read all pages so growth
  // does not silently hide today's tasks or later test records.
  const results = await Promise.all(
    names.map(async (name) => {
      const all: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        let query = supabase!.from(name).select("*");
        if (name === "task_days")
          query = query.eq("study_date", studyDate()).order("task_id");
        else
          query = query.order(
            name === "subjects"
              ? "code"
              : name === "notification_reads"
                ? "notification_id"
                : "id",
          );
        const result = await query.range(offset, offset + 499);
        if (result.error) {
          if (name === "notifications" || name === "notification_reads") {
            notification_error =
              "Notifications could not load. Check your connection and retry. If this continues, ask Host to finish the app update.";
            return [];
          }
          throw new Error(result.error.message);
        }
        all.push(...result.data);
        if (result.data.length < 500) break;
      }
      return all;
    }),
  );
  const data = Object.fromEntries(
    names.map((n, i) => [n, n === "settings" ? results[i][0] : results[i]]),
  ) as Omit<Data, "scores">;
  return { ...data, scores, notification_error };
}
export async function proofLinks(testId: string) {
  if (!supabase) throw new Error("Demo proofs are not real files.");
  const { data, error } = await supabase
    .from("evidence")
    .select("object_path")
    .eq("test_id", testId);
  if (error) throw new Error(error.message);
  return Promise.all(
    (data ?? []).map(async (e) => {
      const r = await supabase!.storage
        .from("test-proofs")
        .createSignedUrl(e.object_path, 60);
      if (r.error) throw new Error(r.error.message);
      return { url: r.data.signedUrl, name: e.object_path.split("/").at(-1)! };
    }),
  );
}
