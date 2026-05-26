import path from "node:path";

export const SCRIPTURE_XREF_SQLITE_REL = path.join("data", "bible", "sqlite", "scripture-xrefs.sqlite");

export const SCRIPTURE_XREF_SQLITE_FORMAT = "selah-scripture-xrefs-v1";

export const SCRIPTURE_XREF_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS xref_out (
  from_book_id TEXT NOT NULL,
  from_chapter INTEGER NOT NULL,
  from_verse INTEGER NOT NULL,
  to_book_id TEXT NOT NULL,
  to_chapter INTEGER NOT NULL,
  to_verse_start INTEGER NOT NULL,
  to_verse_end INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (from_book_id, from_chapter, from_verse, to_book_id, to_chapter, to_verse_start)
);
CREATE INDEX IF NOT EXISTS idx_xref_out_ch ON xref_out(from_book_id, from_chapter);
CREATE TABLE IF NOT EXISTS xref_in (
  to_book_id TEXT NOT NULL,
  to_chapter INTEGER NOT NULL,
  to_verse INTEGER NOT NULL,
  from_book_id TEXT NOT NULL,
  from_chapter INTEGER NOT NULL,
  from_verse INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (to_book_id, to_chapter, to_verse, from_book_id, from_chapter, from_verse)
);
CREATE INDEX IF NOT EXISTS idx_xref_in_ch ON xref_in(to_book_id, to_chapter);
`;

export function scriptureXrefSqlitePath(cwd: string): string {
  return path.join(cwd, SCRIPTURE_XREF_SQLITE_REL);
}
