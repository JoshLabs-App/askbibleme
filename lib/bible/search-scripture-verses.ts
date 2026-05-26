import { getScriptureDatabase } from "@/lib/bible/scripture-sqlite-db";
import {
  escapeSqliteLikePattern,
  hitsFromRows,
  isBookInScriptureSearchScope,
  normalizeScriptureSearchQuery,
  SCRIPTURE_SEARCH_LIMIT,
  SCRIPTURE_SEARCH_MIN_LEN,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
  DEFAULT_SCRIPTURE_SEARCH_SCOPE,
} from "@/lib/bible/scripture-search";

export type { ScriptureSearchScope };

export type { ScriptureSearchHit };

const SCOPED_FETCH_LIMIT = 120;

export class ScriptureSearchDatabaseError extends Error {
  constructor(translationId: string) {
    super(`译本数据库不可用：${translationId}`);
    this.name = "ScriptureSearchDatabaseError";
  }
}

export async function searchScriptureVerses(
  cwd: string,
  translationId: string,
  query: string,
  scope: ScriptureSearchScope = DEFAULT_SCRIPTURE_SEARCH_SCOPE,
): Promise<ScriptureSearchHit[]> {
  const tid = String(translationId || "").trim();
  if (!tid) return [];

  const q = normalizeScriptureSearchQuery(query);
  if (!q || q.length < SCRIPTURE_SEARCH_MIN_LEN) return [];

  const db = await getScriptureDatabase(cwd, tid);
  if (!db) throw new ScriptureSearchDatabaseError(tid);

  const like = `%${escapeSqliteLikePattern(q)}%`;
  const fetchLimit = scope === "all" ? SCRIPTURE_SEARCH_LIMIT : SCOPED_FETCH_LIMIT;
  const sql =
    "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ORDER BY book_id, chapter, verse LIMIT ?";

  const stmt = db.prepare(sql);
  const rows: { book_id: string; chapter: number; verse: number; text: string }[] = [];
  try {
    stmt.bind([like, fetchLimit]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const bookId = String(row.book_id ?? "");
      if (!isBookInScriptureSearchScope(bookId, scope)) continue;
      rows.push({
        book_id: bookId,
        chapter: Number(row.chapter),
        verse: Number(row.verse),
        text: String(row.text ?? ""),
      });
    }
  } finally {
    stmt.free();
  }
  return hitsFromRows(rows.slice(0, SCRIPTURE_SEARCH_LIMIT));
}
