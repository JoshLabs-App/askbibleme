import { getScriptureBookDisplayName } from "./scripture-book-display-name";
import { scriptureBooks, testamentForBookNumber, type ScriptureTestament } from "./scripture-books";

export type ScriptureSearchHit = {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
};

export const SCRIPTURE_SEARCH_MIN_LEN = 1;
export const SCRIPTURE_SEARCH_LIMIT = 40;

export type ScriptureSearchScope = "all" | ScriptureTestament;

export const DEFAULT_SCRIPTURE_SEARCH_SCOPE: ScriptureSearchScope = "all";

export function scriptureSearchScopeSqlFilter(scope: ScriptureSearchScope): {
  sql: string;
  params: string[];
} {
  if (scope === "all") return { sql: "", params: [] };
  const ids = scriptureBooks
    .filter((b) => testamentForBookNumber(b.bookNumber) === scope)
    .map((b) => b.bookId);
  return { sql: ` AND book_id IN (${ids.map(() => "?").join(",")})`, params: ids };
}

export function isBookInScriptureSearchScope(bookId: string, scope: ScriptureSearchScope): boolean {
  if (scope === "all") return true;
  const book = scriptureBooks.find((b) => b.bookId === bookId);
  if (!book) return false;
  return testamentForBookNumber(book.bookNumber) === scope;
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
  return getScriptureBookDisplayName(bookId);
}

type VerseRow = Record<string, unknown>;

function verseRowField(row: VerseRow, key: string): unknown {
  if (key in row) return row[key];
  const upper = key.toUpperCase();
  if (upper in row) return row[upper];
  return undefined;
}

export function hitsFromRows(rows: VerseRow[]): ScriptureSearchHit[] {
  return rows
    .map((row) => {
      const bookId = String(verseRowField(row, "book_id") ?? "").trim();
      const chapter = Number(verseRowField(row, "chapter"));
      const verse = Number(verseRowField(row, "verse"));
      const text = String(verseRowField(row, "text") ?? "").trim();
      if (!bookId || !Number.isFinite(chapter) || !Number.isFinite(verse) || !text) return null;
      return {
        bookId,
        bookName: bookNameForId(bookId),
        chapter,
        verse,
        text,
      };
    })
    .filter((hit): hit is ScriptureSearchHit => hit != null);
}
