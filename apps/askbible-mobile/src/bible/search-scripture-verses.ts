import { isBundledScriptureTranslation } from "./bundled-scripture-translations";
import { retryScriptureDatabaseOnPrepareError } from "./scripture-database";
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

export async function searchScriptureVersesMobile(
  translationId: string,
  query: string,
  scope: ScriptureSearchScope = DEFAULT_SCRIPTURE_SEARCH_SCOPE,
): Promise<ScriptureSearchHit[]> {
  const tid = String(translationId || "").trim();
  if (!tid) return [];
  if (!isBundledScriptureTranslation(tid)) {
    throw new Error(`译本未内置：${tid}`);
  }

  const q = normalizeScriptureSearchQuery(query);
  if (!q || q.length < SCRIPTURE_SEARCH_MIN_LEN) return [];

  const like = `%${escapeSqliteLikePattern(q)}%`;
  const fetchLimit = scope === "all" ? SCRIPTURE_SEARCH_LIMIT : SCOPED_FETCH_LIMIT;

  const rows = await retryScriptureDatabaseOnPrepareError(tid, (db) =>
    db.getAllAsync<Record<string, unknown>>(
      "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ORDER BY book_id, chapter, verse LIMIT ?",
      like,
      fetchLimit,
    ),
  );

  const filtered = rows
    .filter((row) => isBookInScriptureSearchScope(String(row.book_id ?? row.BOOK_ID ?? ""), scope))
    .slice(0, SCRIPTURE_SEARCH_LIMIT);

  return hitsFromRows(filtered);
}
