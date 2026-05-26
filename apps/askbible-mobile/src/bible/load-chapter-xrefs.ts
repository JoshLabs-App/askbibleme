import { retryScriptureXrefDatabaseOnPrepareError } from "./scripture-xref-database";
import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "./scripture-xref-types";

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

export async function loadChapterXrefs(
  bookId: string,
  chapter: number,
): Promise<ScriptureVerseXrefs[] | null> {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;

  return retryScriptureXrefDatabaseOnPrepareError(async (db) => {
    const byVerse = new Map<number, ScriptureVerseXrefs>();

    const outRows = await db.getAllAsync<{
      from_verse: number;
      to_book_id: string;
      to_chapter: number;
      to_verse_start: number;
      to_verse_end: number;
      priority: number;
    }>(
      `SELECT from_verse, to_book_id, to_chapter, to_verse_start, to_verse_end, priority
       FROM xref_out
       WHERE from_book_id = ? AND from_chapter = ?
       ORDER BY from_verse, priority DESC`,
      id,
      ch,
    );

    for (const row of outRows) {
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

    const inRows = await db.getAllAsync<{
      to_verse: number;
      from_book_id: string;
      from_chapter: number;
      from_verse: number;
      priority: number;
    }>(
      `SELECT to_verse, from_book_id, from_chapter, from_verse, priority
       FROM xref_in
       WHERE to_book_id = ? AND to_chapter = ?
       ORDER BY to_verse, priority DESC`,
      id,
      ch,
    );

    for (const row of inRows) {
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

    return [...byVerse.values()].sort((a, b) => a.verse - b.verse);
  });
}
