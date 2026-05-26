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
