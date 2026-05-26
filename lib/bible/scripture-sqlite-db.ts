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

export function invalidateScriptureSqliteCache(translationId?: string): void {
  if (translationId === undefined) {
    for (const [, v] of cache) {
      try {
        v.db.close();
      } catch {
        /* ignore */
      }
    }
    cache.clear();
    return;
  }
  const id = String(translationId || "").trim();
  const hit = cache.get(id);
  if (hit) {
    try {
      hit.db.close();
    } catch {
      /* ignore */
    }
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
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.db;

  if (hit) {
    try {
      hit.db.close();
    } catch {
      /* ignore */
    }
    cache.delete(id);
  }

  const SQL = await getSqlJsStatic(cwd);
  const buf = fs.readFileSync(abs);
  const db = new SQL.Database(new Uint8Array(buf));
  cache.set(id, { mtimeMs: st.mtimeMs, db });
  return db;
}
