import { isBundledScriptureTranslation } from "./bundled-scripture-translations";
import { getScriptureBookDisplayName } from "./scripture-book-display-name";
import { scriptureBooks } from "./scripture-books";
import { getScriptureDatabase, retryScriptureDatabaseOnPrepareError } from "./scripture-database";
import { loadedChapterVerseFromRow } from "./verse-annotations";
import type { LoadedChapter } from "./types";
import {
  DEFAULT_SCRIPTURE_LABEL_EN,
  DEFAULT_SCRIPTURE_LABEL_ZH,
  DEFAULT_SCRIPTURE_TRANSLATION_ID,
} from "./types";

const BOOK_RE = /^[A-Z0-9]{2,8}$/;

export type LoadedChapterLabels = {
  labelZh: string;
  labelEn: string;
};

function isMissingAnnotationColumnError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return msg.includes("speech_spans") || msg.includes("theme_repeat_count") || msg.includes("no such column");
}

type VerseRow = {
  verse: number;
  text: string;
  speech_spans?: string;
  flags?: number;
  theme_repeat_count?: number;
};

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

async function queryChapterVerses(
  db: Awaited<ReturnType<typeof getScriptureDatabase>>,
  bookId: string,
  chapter: number,
): Promise<VerseRow[]> {
  try {
    return await db.getAllAsync<VerseRow>(
      "SELECT verse, text, speech_spans, flags, theme_repeat_count FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC",
      bookId,
      chapter,
    );
  } catch (err) {
    if (!isMissingAnnotationColumnError(err)) throw err;
    try {
      return await db.getAllAsync<VerseRow>(
        "SELECT verse, text, speech_spans, flags FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC",
        bookId,
        chapter,
      );
    } catch (err2) {
      if (!isMissingAnnotationColumnError(err2)) throw err2;
      const legacy = await db.getAllAsync<{ verse: number; text: string }>(
        "SELECT verse, text FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC",
        bookId,
        chapter,
      );
      return legacy.map((row: { verse: number; text: string }) => ({ verse: row.verse, text: row.text }));
    }
  }
}

/**
 * 从设备内 SQLite 读取一章（离线）。查询与 Web `loadChapterFromSqlite` 一致。
 */
export async function loadChapterFromBundledTranslation(
  bookId: string,
  chapter: number,
  translationId: string = DEFAULT_SCRIPTURE_TRANSLATION_ID,
  labels: LoadedChapterLabels = {
    labelZh: DEFAULT_SCRIPTURE_LABEL_ZH,
    labelEn: DEFAULT_SCRIPTURE_LABEL_EN,
  },
): Promise<LoadedChapter | null> {
  const tid = String(translationId || "").trim();
  if (!isBundledScriptureTranslation(tid)) {
    return null;
  }

  const id = String(bookId || "").trim().toUpperCase();
  if (!BOOK_RE.test(id)) return null;

  const bookMeta = scriptureBooks.find((b) => b.bookId === id);
  if (!bookMeta) return null;

  const ch = Number(chapter);
  if (!Number.isInteger(ch) || ch < 1 || ch > bookMeta.chapters) return null;

  let rows: VerseRow[];
  try {
    rows = await retryScriptureDatabaseOnPrepareError(tid, (db) => queryChapterVerses(db, id, ch));
  } catch (err) {
    if (!isNativeDatabaseRejectedError(err)) throw err;
    return null;
  }

  const verses = rows
    .map((row) =>
      loadedChapterVerseFromRow({
        verse: Number(row.verse),
        text: String(row.text ?? ""),
        speech_spans: String(row.speech_spans ?? ""),
        flags: Number(row.flags ?? 0),
        theme_repeat_count: Number(row.theme_repeat_count ?? 0),
      }),
    )
    .filter((v): v is NonNullable<typeof v> => v != null);

  if (verses.length === 0) return null;

  return {
    translationId: tid,
    labelZh: labels.labelZh,
    labelEn: labels.labelEn,
    bookId: id,
    bookName: getScriptureBookDisplayName(id),
    chapter: ch,
    verses,
  };
}
