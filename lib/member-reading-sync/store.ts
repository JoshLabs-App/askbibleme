import fs from "node:fs/promises";
import path from "node:path";
import type { MemberReadingSyncDocumentV1, MemberReadingSyncPushV1 } from "./schema";
import { mergeMemberReadingSyncDocuments } from "./merge";

function sanitizeUserId(userId: string): string | null {
  const safe = userId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return safe || null;
}

export function memberReadingSyncDir(cwd = process.cwd()): string | null {
  const external =
    process.env.MEMBER_READING_SYNC_DATA_DIR?.trim() || process.env.DATA_ROOT?.trim();
  if (external) return path.join(path.resolve(external), "member-reading-sync");
  if (process.env.NODE_ENV === "production") return null;
  return path.join(cwd, "data", "member-reading-sync");
}

export function memberReadingSyncConfigured(cwd = process.cwd()): boolean {
  return memberReadingSyncDir(cwd) != null;
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

export async function readMemberReadingSyncDocument(
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

export async function writeMemberReadingSyncDocument(
  doc: MemberReadingSyncDocumentV1,
  cwd = process.cwd(),
): Promise<boolean> {
  const filePath = memberReadingSyncFilePath(doc.userId, cwd);
  const dir = memberReadingSyncDir(cwd);
  if (!filePath || !dir) return false;
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2), "utf8");
  await fs.rename(tmp, filePath);
  return true;
}

export async function upsertMemberReadingSyncDocument(
  userId: string,
  push: MemberReadingSyncPushV1,
  cwd = process.cwd(),
): Promise<MemberReadingSyncDocumentV1 | null> {
  const existing = await readMemberReadingSyncDocument(userId, cwd);
  const merged = mergeMemberReadingSyncDocuments(userId, existing, push);
  const ok = await writeMemberReadingSyncDocument(merged, cwd);
  return ok ? merged : null;
}
