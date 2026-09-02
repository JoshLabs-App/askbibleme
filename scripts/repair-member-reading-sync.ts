#!/usr/bin/env node
/**
 * 一次性收尾：把 Render 磁盘上残留的（本站已停止写入）会员读经同步数据
 * 并入 Supabase —— 只写 Supabase，不再回写磁盘（磁盘路径已废弃）。
 *
 * 用法：
 *   npm run member:repair-reading-sync -- --user-id=USER_ID
 *   npm run member:repair-reading-sync -- --all
 *   npm run member:repair-reading-sync -- --all --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  memberReadingSyncConfigured,
  memberReadingSyncDir,
  readMemberReadingSyncDocumentForRepair,
  writeMemberReadingSyncDocument,
} from "@/lib/member-reading-sync/store";

type Args = {
  userId: string | null;
  all: boolean;
  dryRun: boolean;
};

type SupabaseRow = { user_id: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { userId: null, all: false, dryRun: false };
  for (const raw of argv) {
    const value = raw.trim();
    if (!value) continue;
    if (value === "--all") args.all = true;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value.startsWith("--user-id=")) {
      const next = value.slice("--user-id=".length).trim();
      if (next) args.userId = next;
    } else if (value.startsWith("--userId=")) {
      const next = value.slice("--userId=".length).trim();
      if (next) args.userId = next;
    }
  }
  if (!args.userId) {
    const fromEnv =
      process.env.ASKBIBLE_MEMBER_READING_SYNC_USER_ID?.trim() ||
      process.env.MEMBER_READING_SYNC_USER_ID?.trim();
    if (fromEnv) args.userId = fromEnv;
  }
  return args;
}

function readDiskUserIds(): string[] {
  const dir = memberReadingSyncDir();
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.basename(entry.name, ".json"))
    .filter(Boolean);
}

async function readSupabaseUserIds(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin.from("member_reading_sync_documents").select("user_id");
  if (error || !data) return [];
  return (data as SupabaseRow[])
    .map((row) => String(row.user_id ?? "").trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort();
}

function summarizeDoc(doc: Awaited<ReturnType<typeof readMemberReadingSyncDocumentForRepair>>): string {
  if (!doc) return "none";
  const keys = Object.keys(doc.blobs ?? {});
  return `${keys.length} blob(s)`;
}

async function repairUser(userId: string, dryRun: boolean): Promise<{ userId: string; ok: boolean; detail: string }> {
  const before = await readMemberReadingSyncDocumentForRepair(userId);
  if (!before || Object.keys(before.blobs ?? {}).length === 0) {
    return { userId, ok: true, detail: "no sync data" };
  }

  if (dryRun) {
    return { userId, ok: true, detail: `dry-run: would write ${summarizeDoc(before)} to Supabase` };
  }

  const wrote = await writeMemberReadingSyncDocument(before);
  return wrote
    ? { userId, ok: true, detail: `merged into Supabase: ${summarizeDoc(before)}` }
    : { userId, ok: false, detail: "write failed" };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configured = memberReadingSyncConfigured();
  if (!configured) {
    console.error("member reading sync is not configured.");
    process.exit(1);
  }

  const explicitUserIds = args.userId ? [args.userId] : [];
  const diskUserIds = args.all ? readDiskUserIds() : [];
  const supabaseUserIds = args.all ? await readSupabaseUserIds() : [];
  const targets = uniqueStrings([...explicitUserIds, ...diskUserIds, ...supabaseUserIds]);

  if (!args.all && targets.length === 0) {
    console.error("Please pass --user-id=... or --all.");
    process.exit(1);
  }

  console.log(
    [
      `member reading sync repair`,
      `mode=${args.dryRun ? "dry-run" : "write"}`,
      `targets=${targets.length}`,
    ].join(" | "),
  );

  const results = [];
  for (const userId of targets) {
    const result = await repairUser(userId, args.dryRun);
    results.push(result);
    const status = result.ok ? "✓" : "✗";
    console.log(`${status} ${userId}: ${result.detail}`);
  }

  const okCount = results.filter((item) => item.ok).length;
  const failCount = results.length - okCount;
  console.log(`\nDone. ok=${okCount} fail=${failCount}`);
  if (failCount > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
