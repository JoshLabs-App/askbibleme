import {
  scriptureBooks,
  testamentForBookNumber,
  type ScriptureTestament,
} from "@/lib/bible/scripture-books";

export type ScriptureSearchHit = {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
};

export const SCRIPTURE_SEARCH_MIN_LEN = 1;
export const SCRIPTURE_SEARCH_LIMIT = 40;

export type ScriptureSearchChapterRef = {
  bookId: string;
  chapter: number;
};

export type ScriptureSearchScope = "all" | ScriptureTestament | "chapter";

export const DEFAULT_SCRIPTURE_SEARCH_SCOPE: ScriptureSearchScope = "all";

/** 关键词搜索时在 SQL 中追加 `AND book_id IN (...)` */
export function scriptureSearchScopeSqlFilter(scope: ScriptureSearchScope): {
  sql: string;
  params: string[];
} {
  if (scope === "all" || scope === "chapter") return { sql: "", params: [] };
  const ids = scriptureBooks
    .filter((b) => testamentForBookNumber(b.bookNumber) === scope)
    .map((b) => b.bookId);
  return { sql: ` AND book_id IN (${ids.map(() => "?").join(",")})`, params: ids };
}

export function isBookInScriptureSearchScope(bookId: string, scope: ScriptureSearchScope): boolean {
  if (scope === "all") return true;
  if (scope === "chapter") return false;
  const book = scriptureBooks.find((b) => b.bookId === bookId);
  if (!book) return false;
  return testamentForBookNumber(book.bookNumber) === scope;
}

export function isVerseInScriptureSearchScope(
  bookId: string,
  chapter: number,
  scope: ScriptureSearchScope,
  chapterRef?: ScriptureSearchChapterRef | null,
): boolean {
  if (scope === "all") return true;
  if (scope === "chapter") {
    return Boolean(
      chapterRef &&
        bookId === chapterRef.bookId &&
        Number.isInteger(chapter) &&
        chapter === chapterRef.chapter,
    );
  }
  return isBookInScriptureSearchScope(bookId, scope);
}

export function normalizeScriptureSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function parseScriptureSearchQueryParam(
  raw: string | string[] | null | undefined,
): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return normalizeScriptureSearchQuery(s ?? "");
}

export type ScriptureSearchTextSegment = {
  text: string;
  match: boolean;
};

/** 按搜索词切分经文（大小写不敏感），供章页关键词高亮。 */
export function splitTextByScriptureSearchKeyword(
  text: string,
  keyword: string,
): ScriptureSearchTextSegment[] {
  const q = normalizeScriptureSearchQuery(keyword);
  if (!q) return [{ text, match: false }];
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const segments: ScriptureSearchTextSegment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQ, cursor);
    if (idx < 0) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) {
      segments.push({ text: text.slice(cursor, idx), match: false });
    }
    segments.push({ text: text.slice(idx, idx + q.length), match: true });
    cursor = idx + q.length;
  }
  return segments.length ? segments : [{ text, match: false }];
}

export function escapeSqliteLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function bookNameForId(bookId: string): string {
  return scriptureBooks.find((b) => b.bookId === bookId)?.bookName ?? bookId;
}

export function hitsFromRows(
  rows: { book_id: string; chapter: number; verse: number; text: string }[],
): ScriptureSearchHit[] {
  return rows.map((row) => ({
    bookId: String(row.book_id),
    bookName: bookNameForId(String(row.book_id)),
    chapter: Number(row.chapter),
    verse: Number(row.verse),
    text: String(row.text ?? "").trim(),
  }));
}
