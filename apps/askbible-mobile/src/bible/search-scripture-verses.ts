import { isScriptureTranslationInstalled, retryScriptureDatabaseOnPrepareError } from "./scripture-database";
import {
  escapeSqliteLikePattern,
  hitsFromRows,
  isBookInScriptureSearchScope,
  normalizeScriptureSearchQuery,
  DEFAULT_SCRIPTURE_SEARCH_SCOPE,
  SCRIPTURE_SEARCH_LIMIT,
  SCRIPTURE_SEARCH_MIN_LEN,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
} from "./scripture-search";

export type { ScriptureSearchHit, ScriptureSearchScope };

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
): Promise<ScriptureSearchHit[]> {
  const tid = String(translationId || "").trim();
  if (!tid) return [];
  if (!(await isScriptureTranslationInstalled(tid))) {
    throw new Error(`译本未下载：${tid}`);
  }

  const q = normalizeScriptureSearchQuery(query);
  if (!q || q.length < SCRIPTURE_SEARCH_MIN_LEN) return [];

  const like = `%${escapeSqliteLikePattern(q)}%`;
  const fetchLimit = scope === "all" ? SCRIPTURE_SEARCH_LIMIT : SCOPED_FETCH_LIMIT;

  let rows: Record<string, unknown>[];
  try {
    rows = await retryScriptureDatabaseOnPrepareError(tid, (db) =>
      db.getAllAsync<Record<string, unknown>>(
        "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ORDER BY book_id, chapter, verse LIMIT ?",
        like,
        fetchLimit,
      ),
    );
  } catch (err) {
    if (!isNativeDatabaseRejectedError(err)) throw err;
    return [];
  }

  const filtered = rows
    .filter((row) => isBookInScriptureSearchScope(String(row.book_id ?? row.BOOK_ID ?? ""), scope))
    .slice(0, SCRIPTURE_SEARCH_LIMIT);

  return hitsFromRows(filtered);
}
