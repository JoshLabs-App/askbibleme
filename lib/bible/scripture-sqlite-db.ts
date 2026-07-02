import fs from "node:fs";
import path from "node:path";
import type { Database } from "sql.js";
import { getSqlJsStatic } from "@/lib/bible/sql-js-wasm";

export const SCRIPTURE_SQLITE_DIR_REL = path.join("data", "bible", "sqlite");

export const SELAH_SCRIPTURE_SQLITE_FORMAT = "selah-scripture-sqlite-v3";

export const SCRIPTURE_SQLITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verse (
  book_id TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  speech_spans TEXT NOT NULL DEFAULT '',
  flags INTEGER NOT NULL DEFAULT 0,
  theme_repeat_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, chapter, verse)
);
CREATE INDEX IF NOT EXISTS idx_verse_ch ON verse(book_id, chapter);
`;

export function scriptureSqlitePath(cwd: string, translationId: string): string {
  const id = String(translationId || "").trim();
  return path.join(cwd, SCRIPTURE_SQLITE_DIR_REL, `${id}.sqlite`);
}

const cache = new Map<string, { mtimeMs: number; db: Database }>();

/** sql.js 会把整库读进 wasm 堆；无上限缓存多译本易 OOM。默认最多保留 4 本，可用环境变量覆盖。 */
const MAX_OPEN_SCRIPTURE_DATABASES = Math.max(
  1,
  Number.parseInt(process.env.SCRIPTURE_SQLITE_CACHE_MAX ?? "4", 10) || 4,
);

function touchScriptureCache(id: string, entry: { mtimeMs: number; db: Database }): void {
  cache.delete(id);
  cache.set(id, entry);
}

function closeScriptureCacheEntry(entry: { mtimeMs: number; db: Database }): void {
  try {
    entry.db.close();
  } catch {
    /* ignore */
  }
}

function evictOldestScriptureCacheEntry(): void {
  const oldestId = cache.keys().next().value as string | undefined;
  if (!oldestId) return;
  const entry = cache.get(oldestId);
  if (entry) closeScriptureCacheEntry(entry);
  cache.delete(oldestId);
}

export function invalidateScriptureSqliteCache(translationId?: string): void {
  if (translationId === undefined) {
    for (const [, v] of cache) {
      closeScriptureCacheEntry(v);
    }
    cache.clear();
    return;
  }
  const id = String(translationId || "").trim();
  const hit = cache.get(id);
  if (hit) {
    closeScriptureCacheEntry(hit);
    cache.delete(id);
  }
}

export async function getScriptureDatabase(cwd: string, translationId: string): Promise<Database | null> {
  const id = String(translationId || "").trim();
  if (!id) return null;
  const abs = scriptureSqlitePath(cwd, id);
  if (!fs.existsSync(abs)) return null;
  const st = fs.statSync(abs);
  const hit = cache.get(id);
  if (hit && hit.mtimeMs === st.mtimeMs) {
    touchScriptureCache(id, hit);
    return hit.db;
  }

  if (hit) {
    closeScriptureCacheEntry(hit);
    cache.delete(id);
  }

  while (cache.size >= MAX_OPEN_SCRIPTURE_DATABASES) {
    evictOldestScriptureCacheEntry();
  }

  const SQL = await getSqlJsStatic(cwd);
  const buf = fs.readFileSync(abs);
  const db = new SQL.Database(new Uint8Array(buf));
  touchScriptureCache(id, { mtimeMs: st.mtimeMs, db });
  return db;
}
