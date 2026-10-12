// Server/operator only. Never import this in src/ or run it in public CI.
// Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local environment.
// Dry-run by default. Use --apply only after reviewing the printed orphan paths.
import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import console from "node:console";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Provide server credentials through your local environment, never in source or chat.",
  );
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const cutoff = Date.now() - 7 * 86400000;
const { data: tests, error } = await client
  .from("tests")
  .select("id,owner_id")
  .eq("status", "draft");
if (error) throw error;
for (const test of tests) {
  const prefix = `${test.owner_id}/${test.id}`;
  let offset = 0;
  while (true) {
    const listing = await client.storage
      .from("test-proofs")
      .list(prefix, { limit: 100, offset });
    if (listing.error) throw listing.error;
    if (!listing.data.length) break;
    offset += listing.data.length;
    for (const file of listing.data) {
      if (!file.id || Date.parse(file.created_at) > cutoff) continue;
      const path = `${prefix}/${file.name}`;
      // Re-check immediately before deletion; submitted/retained evidence is never cleaned.
      const [
        { data: current, error: readError },
        { data: reference, error: refError },
      ] = await Promise.all([
        client.from("tests").select("status").eq("id", test.id).single(),
        client
          .from("evidence")
          .select("id")
          .eq("object_path", path)
          .maybeSingle(),
      ]);
      if (readError || refError) throw readError || refError;
      if (current.status !== "draft" || reference) continue;
      console.log("Unreferenced draft upload older than 7 days:", path);
      if (process.argv.includes("--apply")) {
        const result = await client.storage.from("test-proofs").remove([path]);
        if (result.error) throw result.error;
      }
    }
  }
}
