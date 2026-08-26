#!/usr/bin/env node
/**
 * Verify remote Supabase schema + delete-account edge function for AskBible.
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/supabase-verify.mjs
 */
const url = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://tgobadhdylarhssudplc.supabase.co"
).replace(/\/$/, "");
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb2JhZGhkeWxhcmhzc3VkcGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTMwMDAsImV4cCI6MjA5Njc4OTAwMH0.5EqC5hJFmydZaVBmpXJk1ddJNGX_fY2hN83k5IzAO3I";

/** REST probe column per table (none use `id`). */
const tables = [
  { name: "askbible_profiles", select: "user_id" },
  { name: "member_reading_sync_documents", select: "user_id" },
  { name: "feedback_submissions", select: "id" },
  { name: "content_corrections", select: "id" },
];

async function checkTable(name, select) {
  const res = await fetch(`${url}/rest/v1/${name}?select=${select}&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const text = await res.text();
  if (res.status === 404 && text.includes("PGRST205")) {
    return { ok: false, detail: "missing_table" };
  }
  if (res.status >= 400 && res.status !== 200) {
    return { ok: false, detail: `HTTP ${res.status} ${text.slice(0, 120)}` };
  }
  return { ok: true };
}

async function checkDeleteAccountFunction() {
  const res = await fetch(`${url}/functions/v1/delete-account`, {
    method: "DELETE",
    headers: { apikey: anon },
  });
  const text = await res.text();
  if (res.status === 404) return { ok: false, detail: "function_not_found" };
  if (res.status === 401) return { ok: true, detail: "reachable_unauthorized" };
  return { ok: res.status < 500, detail: `HTTP ${res.status} ${text.slice(0, 80)}` };
}

let failed = 0;
for (const table of tables) {
  const r = await checkTable(table.name, table.select);
  const mark = r.ok ? "OK" : "FAIL";
  console.log(`${mark} table ${table.name}${r.detail ? ` (${r.detail})` : ""}`);
  if (!r.ok) failed += 1;
}

const fn = await checkDeleteAccountFunction();
console.log(`${fn.ok ? "OK" : "FAIL"} function delete-account (${fn.detail})`);
if (!fn.ok) failed += 1;

process.exit(failed ? 1 : 0);
