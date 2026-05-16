import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";

export const READER_VERSE_THEMES_SQLITE_REL = "data/scripture/reader-verse-themes.sqlite";

export function readerVerseThemesSqlitePath(cwd: string): string {
  return path.join(cwd, READER_VERSE_THEMES_SQLITE_REL);
}

let cached: { mtimeMs: number; db: Database } | null = null;

export function invalidateReaderVerseThemesDbCache(): void {
  if (cached) {
    try {
      cached.db.close();
    } catch {
      /* ignore */
    }
    cached = null;
  }
}

export async function getReaderVerseThemesDatabase(cwd: string): Promise<Database | null> {
  const abs = readerVerseThemesSqlitePath(cwd);
  if (!fs.existsSync(abs)) return null;
  const st = fs.statSync(abs);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.db;

  invalidateReaderVerseThemesDbCache();
  const wasmPath = path.join(cwd, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const buf = fs.readFileSync(abs);
  const db = new SQL.Database(new Uint8Array(buf));
  cached = { mtimeMs: st.mtimeMs, db };
  return db;
}

export const READER_VERSE_THEMES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS category (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS subcategory (
  category_id INTEGER NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  title TEXT,
  advertised_verse_count INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  bucket TEXT NOT NULL,
  PRIMARY KEY (category_id, id),
  FOREIGN KEY (category_id) REFERENCES category(id)
);
CREATE INDEX IF NOT EXISTS idx_sub_bucket ON subcategory(bucket);
CREATE INDEX IF NOT EXISTS idx_sub_category ON subcategory(category_id);
CREATE TABLE IF NOT EXISTS verse (
  category_id INTEGER NOT NULL,
  sub_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  reference TEXT,
  book TEXT,
  book_id TEXT,
  chapter_start INTEGER NOT NULL,
  verse_start INTEGER NOT NULL,
  chapter_end INTEGER NOT NULL,
  verse_end INTEGER NOT NULL,
  verse_text TEXT NOT NULL,
  PRIMARY KEY (category_id, sub_id, position),
  FOREIGN KEY (category_id, sub_id) REFERENCES subcategory(category_id, id)
);
CREATE INDEX IF NOT EXISTS idx_verse_sub ON verse(category_id, sub_id);
`;
