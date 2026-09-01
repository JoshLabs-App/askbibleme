import { getScriptureBookDisplayName } from "./scripture-book-display-name";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export type ReadChapterNeighbor = {
  bookId: string;
  chapter: number;
  bookName: string;
};

/** 与 Web `lib/bible/read-chapter-neighbors.ts` 同序：上一章 / 下一章（可跨卷）。 */
export function resolveReadChapterNeighbors(
  bookId: string,
  chapter: number,
): { prev: ReadChapterNeighbor | null; next: ReadChapterNeighbor | null } {
  const id = String(bookId || "").trim().toUpperCase();
  const bookIndex = scriptureBooks.findIndex((b) => b.bookId === id);
  if (bookIndex < 0) return { prev: null, next: null };

  const book = scriptureBooks[bookIndex]!;
  const ch = Number(chapter);
  if (!Number.isInteger(ch) || ch < 1 || ch > book.chapters) {
    return { prev: null, next: null };
  }

  let prev: ReadChapterNeighbor | null = null;
  if (ch > 1) {
    prev = {
      bookId: book.bookId,
      chapter: ch - 1,
      bookName: getScriptureBookDisplayName(book.bookId),
    };
  } else if (bookIndex > 0) {
    const p = scriptureBooks[bookIndex - 1]!;
    prev = { bookId: p.bookId, chapter: p.chapters, bookName: getScriptureBookDisplayName(p.bookId) };
  }

  let next: ReadChapterNeighbor | null = null;
  if (ch < book.chapters) {
    next = {
      bookId: book.bookId,
      chapter: ch + 1,
      bookName: getScriptureBookDisplayName(book.bookId),
    };
  } else if (bookIndex < scriptureBooks.length - 1) {
    const n = scriptureBooks[bookIndex + 1]!;
    next = { bookId: n.bookId, chapter: 1, bookName: getScriptureBookDisplayName(n.bookId) };
  }

  return { prev, next };
}
