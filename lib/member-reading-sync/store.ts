import fs from "node:fs/promises";
import path from "node:path";
import type { MemberReadingSyncDocumentV1, MemberReadingSyncPushV1 } from "./schema";
import { mergeMemberReadingSyncDocuments } from "./merge";
import {
  memberReadingSyncSupabaseConfigured,
  readMemberReadingSyncDocumentFromSupabase,
  upsertMemberReadingSyncDocumentToSupabase,
} from "./supabase-store";

const RENDER_DEFAULT_DATA_ROOT = "/var/data";

function sanitizeUserId(userId: string): string | null {
  const safe = userId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return safe || null;
}

function resolveMemberReadingSyncDataRoot(): string | null {
  const explicit =
    process.env.MEMBER_READING_SYNC_DATA_DIR?.trim() || process.env.DATA_ROOT?.trim();
  if (explicit) return path.resolve(explicit);
  if (process.env.NODE_ENV === "production") return RENDER_DEFAULT_DATA_ROOT;
  return null;
}

export function memberReadingSyncDir(cwd = process.cwd()): string | null {
  const root = resolveMemberReadingSyncDataRoot();
  if (root) return path.join(root, "member-reading-sync");
  if (process.env.NODE_ENV !== "production") {
    return path.join(cwd, "data", "member-reading-sync");
  }
  return null;
}

export function memberReadingSyncConfigured(cwd = process.cwd()): boolean {
  return memberReadingSyncDir(cwd) != null || memberReadingSyncSupabaseConfigured();
}

function memberReadingSyncFilePath(userId: string, cwd = process.cwd()): string | null {
  const dir = memberReadingSyncDir(cwd);
  const safe = sanitizeUserId(userId);
  if (!dir || !safe) return null;
  return path.join(dir, `${safe}.json`);
}

function parseDocument(raw: string, userId: string): MemberReadingSyncDocumentV1 | null {
  try {
    const parsed = JSON.parse(raw) as Partial<MemberReadingSyncDocumentV1>;
    if (parsed?.schemaVersion !== 1 || typeof parsed.revision !== "string") return null;
    return {
      schemaVersion: 1,
      userId,
      revision: parsed.revision,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      blobs: parsed.blobs && typeof parsed.blobs === "object" ? parsed.blobs : {},
    };
  } catch {
    return null;
  }
}

async function readMemberReadingSyncDocumentFromDisk(
  userId: string,
  cwd = process.cwd(),
): Promise<MemberReadingSyncDocumentV1 | null> {
  const filePath = memberReadingSyncFilePath(userId, cwd);
  if (!filePath) return null;
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parseDocument(raw, userId);
  } catch {
    return null;
  }
}

async function writeMemberReadingSyncDocumentToDisk(
  doc: MemberReadingSyncDocumentV1,
  cwd = process.cwd(),
): Promise<boolean> {
  const filePath = memberReadingSyncFilePath(doc.userId, cwd);
  const dir = memberReadingSyncDir(cwd);
  if (!filePath || !dir) return false;
  try {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(doc, null, 2), "utf8");
    await fs.rename(tmp, filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readMemberReadingSyncDocument(
  userId: string,
  cwd = process.cwd(),
): Promise<MemberReadingSyncDocumentV1 | null> {
  const fromDisk = await readMemberReadingSyncDocumentFromDisk(userId, cwd);
  if (fromDisk) return fromDisk;
  return readMemberReadingSyncDocumentFromSupabase(userId);
}

export async function writeMemberReadingSyncDocument(
  doc: MemberReadingSyncDocumentV1,
  cwd = process.cwd(),
): Promise<boolean> {
  const diskOk = await writeMemberReadingSyncDocumentToDisk(doc, cwd);
  if (diskOk) return true;
  const fromSupabase = await upsertMemberReadingSyncDocumentToSupabase(doc.userId, {
    schemaVersion: 1,
    blobs: doc.blobs,
  });
  return fromSupabase != null;
}

export async function upsertMemberReadingSyncDocument(
  userId: string,
  push: MemberReadingSyncPushV1,
  cwd = process.cwd(),
): Promise<MemberReadingSyncDocumentV1 | null> {
  const existing = await readMemberReadingSyncDocument(userId, cwd);
  const merged = mergeMemberReadingSyncDocuments(userId, existing, push);

  const diskOk = await writeMemberReadingSyncDocumentToDisk(merged, cwd);
  if (diskOk) return merged;

  return upsertMemberReadingSyncDocumentToSupabase(userId, push);
}
