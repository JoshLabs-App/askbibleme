import { isScriptureTranslationInstalled, retryScriptureDatabaseOnPrepareError } from "./scripture-database";
import {
  escapeSqliteLikePattern,
  hitsFromRows,
  isVerseInScriptureSearchScope,
  normalizeScriptureSearchQuery,
  DEFAULT_SCRIPTURE_SEARCH_SCOPE,
  SCRIPTURE_SEARCH_LIMIT,
  SCRIPTURE_SEARCH_MIN_LEN,
  type ScriptureSearchChapterRef,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
} from "./scripture-search";

export type { ScriptureSearchChapterRef, ScriptureSearchHit, ScriptureSearchScope };

const SCOPED_FETCH_LIMIT = 120;

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

export async function searchScriptureVersesMobile(
  translationId: string,
  query: string,
  scope: ScriptureSearchScope = DEFAULT_SCRIPTURE_SEARCH_SCOPE,
  chapterRef?: ScriptureSearchChapterRef | null,
): Promise<ScriptureSearchHit[]> {
  const tid = String(translationId || "").trim();
  if (!tid) return [];
  if (!(await isScriptureTranslationInstalled(tid))) {
    return [];
  }

  const q = normalizeScriptureSearchQuery(query);
  if (!q || q.length < SCRIPTURE_SEARCH_MIN_LEN) return [];

  if (scope === "chapter" && (!chapterRef?.bookId || !Number.isInteger(chapterRef.chapter) || chapterRef.chapter < 1)) {
    return [];
  }

  const like = `%${escapeSqliteLikePattern(q)}%`;

  let rows: Record<string, unknown>[];
  try {
    rows = await retryScriptureDatabaseOnPrepareError(tid, (db) => {
      if (scope === "chapter" && chapterRef) {
        return db.getAllAsync<Record<string, unknown>>(
          "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? AND book_id = ? AND chapter = ? ORDER BY verse LIMIT ?",
          like,
          chapterRef.bookId,
          chapterRef.chapter,
          SCRIPTURE_SEARCH_LIMIT,
        );
      }
      const fetchLimit = scope === "all" ? SCRIPTURE_SEARCH_LIMIT : SCOPED_FETCH_LIMIT;
      return db.getAllAsync<Record<string, unknown>>(
        "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ORDER BY book_id, chapter, verse LIMIT ?",
        like,
        fetchLimit,
      );
    });
  } catch (err) {
    if (!isNativeDatabaseRejectedError(err)) throw err;
    return [];
  }

  if (scope === "chapter") {
    return hitsFromRows(rows).slice(0, SCRIPTURE_SEARCH_LIMIT);
  }

  const filtered = rows
    .filter((row) => {
      const bookId = String(row.book_id ?? row.BOOK_ID ?? "");
      const chapter = Number(row.chapter ?? row.CHAPTER);
      return isVerseInScriptureSearchScope(bookId, chapter, scope, chapterRef);
    })
    .slice(0, SCRIPTURE_SEARCH_LIMIT);

  return hitsFromRows(filtered);
}
