import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { invalidateScriptureSqliteCache, scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "@/lib/bible/translations-types";

const DATA_DIR = "data/bible";
const INDEX_FILE = "translations.json";
const UPLOADS_DIR = "uploads";

function indexPath(cwd: string): string {
  return path.join(cwd, DATA_DIR, INDEX_FILE);
}

function uploadsDir(cwd: string): string {
  return path.join(cwd, DATA_DIR, UPLOADS_DIR);
}

export function translationFileRel(id: string): string {
  return `${UPLOADS_DIR}/${id}.json`;
}

function parseTranslationsIndexJson(raw: string): BibleTranslationsIndex {
  const j = JSON.parse(raw) as BibleTranslationsIndex;
  if (!j || typeof j !== "object" || !Array.isArray(j.translations)) {
    return { translations: [], defaultTranslationId: null };
  }
  return {
    translations: j.translations.filter((t): t is BibleTranslationMeta => Boolean(t?.id)),
    defaultTranslationId:
      typeof j.defaultTranslationId === "string" && j.defaultTranslationId.trim()
        ? j.defaultTranslationId.trim()
        : null,
  };
}

/** 同步读索引（供 RSC / 服务端同步加载经文用）。 */
export function readTranslationsIndexSync(cwd: string): BibleTranslationsIndex {
  const p = indexPath(cwd);
  try {
    const raw = fsSync.readFileSync(p, "utf-8");
    return parseTranslationsIndexJson(raw);
  } catch {
    return { translations: [], defaultTranslationId: null };
  }
}

export async function readTranslationsIndex(cwd: string): Promise<BibleTranslationsIndex> {
  const p = indexPath(cwd);
  try {
    const raw = await fs.readFile(p, "utf-8");
    return parseTranslationsIndexJson(raw);
  } catch {
    return { translations: [], defaultTranslationId: null };
  }
}

export async function writeTranslationsIndex(cwd: string, index: BibleTranslationsIndex): Promise<void> {
  const dir = path.join(cwd, DATA_DIR);
  await fs.mkdir(dir, { recursive: true });
  const p = indexPath(cwd);
  const body = JSON.stringify(
    {
      translations: index.translations,
      defaultTranslationId: index.defaultTranslationId,
    },
    null,
    2,
  );
  await fs.writeFile(p, `${body}\n`, "utf-8");
}

export async function ensureBibleDirs(cwd: string): Promise<void> {
  await fs.mkdir(uploadsDir(cwd), { recursive: true });
}

export function resolveTranslationAbsolutePath(cwd: string, id: string): string {
  const dir = uploadsDir(cwd);
  const finalPath = path.resolve(dir, `${id}.json`);
  const rel = path.relative(dir, finalPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("非法路径。");
  }
  return finalPath;
}

export async function writeTranslationPayload(
  cwd: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<{ bytes: number }> {
  await ensureBibleDirs(cwd);
  const finalPath = resolveTranslationAbsolutePath(cwd, id);
  const normalized = {
    format: payload.format ?? "selah-bible-v1",
    books: payload.books,
  };
  const json = `${JSON.stringify(normalized, null, 2)}\n`;
  const buf = Buffer.from(json, "utf-8");
  await fs.writeFile(finalPath, buf);
  return { bytes: buf.length };
}

export async function deleteTranslationFile(cwd: string, id: string): Promise<void> {
  try {
    await fs.unlink(resolveTranslationAbsolutePath(cwd, id));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
  }
  try {
    await fs.unlink(scriptureSqlitePath(cwd, id));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
  }
  invalidateScriptureSqliteCache(id);
}
