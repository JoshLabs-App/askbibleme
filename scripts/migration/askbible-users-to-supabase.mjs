#!/usr/bin/env node
/**
 * Import AskBible auth.sqlite users into shared Supabase (josh-apps).
 *
 * Usage:
 *   ASKBIBLE_AUTH_SQLITE_PATH=/path/to/auth.sqlite \
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/migration/askbible-users-to-supabase.mjs
 *
 * Options:
 *   --dry-run   Print actions without writing
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv(path.join(repoRoot, ".env.local"));
loadDotEnv(path.join(repoRoot, ".env"));
const dryRun = process.argv.includes("--dry-run");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const dbPath =
  process.env.ASKBIBLE_AUTH_SQLITE_PATH?.trim() ||
  path.resolve(__dirname, "../../admin_data/auth.sqlite");

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`auth.sqlite not found: ${dbPath}`);
  process.exit(1);
}

const wasmPath = path.resolve(__dirname, "../../node_modules/sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({ locateFile: () => wasmPath });
const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));

const rows = [];
const stmt = db.prepare(
  "SELECT id, name, email, password_hash, is_admin, admin_role, online_seconds_total, color_theme_id FROM users ORDER BY created_at",
);
while (stmt.step()) {
  rows.push(stmt.getAsObject());
}
stmt.free();
db.close();

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isUuidV4(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

let imported = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const id = String(row.id ?? "").trim();
  const email = String(row.email ?? "").trim().toLowerCase();
  const name = String(row.name ?? "").trim() || email;
  const hash = String(row.password_hash ?? "");
  const isAdmin = Number(row.is_admin ?? 0) === 1;
  const adminRole = String(row.admin_role ?? "");
  const onlineSeconds = Number(row.online_seconds_total ?? 0) || 0;
  const colorThemeId = String(row.color_theme_id ?? "");

  if (!id || !email || !hash) {
    console.warn(`skip invalid row: ${email || id}`);
    skipped += 1;
    continue;
  }

  const isBcrypt = hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
  if (!isBcrypt) {
    console.warn(`skip legacy SHA256 (needs password reset): ${email}`);
    skipped += 1;
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] import ${email} (${id}) admin=${isAdmin}`);
    imported += 1;
    continue;
  }

  const { data: existingList, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("listUsers failed:", listError.message);
    process.exit(1);
  }
  const existing = existingList.users.find((u) => u.email?.toLowerCase() === email || u.id === id);
  if (existing) {
    console.log(`exists: ${email} → ${existing.id}`);
    const { error: profileError } = await admin.from("askbible_profiles").upsert(
      {
        user_id: existing.id,
        display_name: name,
        locale: "zh",
        is_admin: isAdmin,
        admin_role: adminRole,
        online_seconds_total: onlineSeconds,
        color_theme_id: colorThemeId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (profileError) {
      console.error(`profile upsert failed for ${email}:`, profileError.message);
      failed += 1;
    } else {
      skipped += 1;
    }
    continue;
  }

  const createPayload = {
    email,
    email_confirm: true,
    password_hash: hash,
    user_metadata: { name, legacy_sqlite_id: id },
  };
  if (isUuidV4(id)) createPayload.id = id;

  const { data: created, error: createError } = await admin.auth.admin.createUser(createPayload);

  if (createError) {
    console.error(`create failed ${email}:`, createError.message);
    failed += 1;
    continue;
  }

  const userId = created.user?.id || id;
  const { error: profileError } = await admin.from("askbible_profiles").upsert(
    {
      user_id: userId,
      display_name: name,
      locale: "zh",
      is_admin: isAdmin,
      admin_role: adminRole,
      online_seconds_total: onlineSeconds,
      color_theme_id: colorThemeId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    console.error(`profile failed ${email}:`, profileError.message);
    failed += 1;
    continue;
  }

  console.log(`imported: ${email} (${userId})`);
  imported += 1;
}

console.log(`\nDone. imported=${imported} skipped=${skipped} failed=${failed}${dryRun ? " (dry-run)" : ""}`);
