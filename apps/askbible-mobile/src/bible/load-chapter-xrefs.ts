import { retryScriptureXrefDatabaseOnPrepareError } from "./scripture-xref-database";
import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "./scripture-xref-types";

function isNativeDatabaseRejectedError(err: unknown): boolean {
  const message = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    message.includes("nativedatabase.prepareasync") ||
    message.includes("nativedatabase.preparesync") ||
    message.includes("prepareasync") ||
    message.includes("preparesync") ||
    (message.includes("call to function") && message.includes("nativedatabase."))
  );
}

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

function normalizeChapterRef(bookId: string, chapter: number): { id: string; ch: number } | null {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;
  return { id, ch };
}

/** Lightweight index: which verses in this chapter have any cross-reference link. */
export async function loadChapterXrefVerseNumbers(
  bookId: string,
  chapter: number,
): Promise<number[]> {
  const ref = normalizeChapterRef(bookId, chapter);
  if (!ref) return [];

  try {
    return await retryScriptureXrefDatabaseOnPrepareError(async (db) => {
      const rows = await db.getAllAsync<{ verse: number }>(
        `SELECT DISTINCT from_verse AS verse FROM xref_out
         WHERE from_book_id = ? AND from_chapter = ?
         UNION
         SELECT DISTINCT to_verse AS verse FROM xref_in
         WHERE to_book_id = ? AND to_chapter = ?
         ORDER BY verse`,
        ref.id,
        ref.ch,
        ref.id,
        ref.ch,
      );
      return rows.map((row) => Number(row.verse)).filter((v) => Number.isInteger(v) && v >= 1);
    });
  } catch (err) {
    if (!isNativeDatabaseRejectedError(err)) throw err;
    return [];
  }
}

/** Load cross-reference targets for a single verse when the sheet opens. */
export async function loadVerseXrefs(
  bookId: string,
  chapter: number,
  verse: number,
): Promise<ScriptureVerseXrefs | null> {
  const ref = normalizeChapterRef(bookId, chapter);
  const v = Number(verse);
  if (!ref || !Number.isInteger(v) || v < 1) return null;

  try {
    return await retryScriptureXrefDatabaseOnPrepareError(async (db) => {
      const bucket: ScriptureVerseXrefs = { verse: v, incoming: [], outgoing: [] };

      const outRows = await db.getAllAsync<{
        to_book_id: string;
        to_chapter: number;
        to_verse_start: number;
        to_verse_end: number;
        priority: number;
      }>(
        `SELECT to_book_id, to_chapter, to_verse_start, to_verse_end, priority
         FROM xref_out
         WHERE from_book_id = ? AND from_chapter = ? AND from_verse = ?
         ORDER BY priority DESC`,
        ref.id,
        ref.ch,
        v,
      );

      for (const row of outRows) {
        bucket.outgoing.push(
          rowToTarget(
            String(row.to_book_id),
            Number(row.to_chapter),
            Number(row.to_verse_start),
            Number(row.to_verse_end),
            Number(row.priority),
          ),
        );
      }

      const inRows = await db.getAllAsync<{
        from_book_id: string;
        from_chapter: number;
        from_verse: number;
        priority: number;
      }>(
        `SELECT from_book_id, from_chapter, from_verse, priority
         FROM xref_in
         WHERE to_book_id = ? AND to_chapter = ? AND to_verse = ?
         ORDER BY priority DESC`,
        ref.id,
        ref.ch,
        v,
      );

      for (const row of inRows) {
        const fromVerse = Number(row.from_verse);
        bucket.incoming.push(
          rowToTarget(
            String(row.from_book_id),
            Number(row.from_chapter),
            fromVerse,
            fromVerse,
            Number(row.priority),
          ),
        );
      }

      if (!bucket.incoming.length && !bucket.outgoing.length) return null;
      return bucket;
    });
  } catch (err) {
    if (!isNativeDatabaseRejectedError(err)) throw err;
    return null;
  }
}

export async function loadChapterXrefs(
  bookId: string,
  chapter: number,
): Promise<ScriptureVerseXrefs[] | null> {
  const ref = normalizeChapterRef(bookId, chapter);
  if (!ref) return null;

  try {
    return await retryScriptureXrefDatabaseOnPrepareError(async (db) => {
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
      ref.id,
      ref.ch,
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
      ref.id,
      ref.ch,
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
  } catch (err) {
    if (!isNativeDatabaseRejectedError(err)) throw err;
    return null;
  }
}
