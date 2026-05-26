import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "@/lib/bible/scripture-xref-types";
import { getScriptureXrefDatabase } from "@/lib/bible/scripture-xref-db";

export type ScriptureVerseXrefsSerialized = ScriptureVerseXrefs;

function rowToTarget(
  bookId: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
  priority: number,
): ScriptureXrefTarget {
  return {
    bookId,
    chapter,
    verseStart,
    verseEnd: verseEnd >= verseStart ? verseEnd : verseStart,
    priority,
  };
}

/**
 * Load curated cross-references for one chapter (server / build-time).
 * Returns `null` when sqlite is missing; `[]` when chapter has no xrefs.
 */
export async function loadChapterXrefs(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<ScriptureVerseXrefsSerialized[] | null> {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;

  const db = await getScriptureXrefDatabase(cwd);
  if (!db) return null;

  const byVerse = new Map<number, ScriptureVerseXrefs>();

  const outStmt = db.prepare(
    `SELECT from_verse, to_book_id, to_chapter, to_verse_start, to_verse_end, priority
     FROM xref_out
     WHERE from_book_id = ? AND from_chapter = ?
     ORDER BY from_verse, priority DESC`,
  );
  outStmt.bind([id, ch]);
  while (outStmt.step()) {
    const row = outStmt.getAsObject() as Record<string, unknown>;
    const verse = Number(row.from_verse);
    const target = rowToTarget(
      String(row.to_book_id),
      Number(row.to_chapter),
      Number(row.to_verse_start),
      Number(row.to_verse_end),
      Number(row.priority),
    );
    let bucket = byVerse.get(verse);
    if (!bucket) {
      bucket = { verse, incoming: [], outgoing: [] };
      byVerse.set(verse, bucket);
    }
    bucket.outgoing.push(target);
  }
  outStmt.free();

  const inStmt = db.prepare(
    `SELECT to_verse, from_book_id, from_chapter, from_verse, priority
     FROM xref_in
     WHERE to_book_id = ? AND to_chapter = ?
     ORDER BY to_verse, priority DESC`,
  );
  inStmt.bind([id, ch]);
  while (inStmt.step()) {
    const row = inStmt.getAsObject() as Record<string, unknown>;
    const verse = Number(row.to_verse);
    const v = Number(row.from_verse);
    const target = rowToTarget(
      String(row.from_book_id),
      Number(row.from_chapter),
      v,
      v,
      Number(row.priority),
    );
    let bucket = byVerse.get(verse);
    if (!bucket) {
      bucket = { verse, incoming: [], outgoing: [] };
      byVerse.set(verse, bucket);
    }
    bucket.incoming.push(target);
  }
  inStmt.free();

  return [...byVerse.values()].sort((a, b) => a.verse - b.verse);
}
