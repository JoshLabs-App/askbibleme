import { scriptureBooks } from "@/lib/bible/scripture-books";

export type ReadChapterNeighbor = {
  bookId: string;
  chapter: number;
  bookName: string;
};

/**
 * 按 `scriptureBooks` 顺序与每卷章数，解析「上一章 / 下一章」（跨卷时衔接卷末与卷首）。
 */
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
    prev = { bookId: book.bookId, chapter: ch - 1, bookName: book.bookName };
  } else if (bookIndex > 0) {
    const p = scriptureBooks[bookIndex - 1]!;
    prev = { bookId: p.bookId, chapter: p.chapters, bookName: p.bookName };
  }

  let next: ReadChapterNeighbor | null = null;
  if (ch < book.chapters) {
    next = { bookId: book.bookId, chapter: ch + 1, bookName: book.bookName };
  } else if (bookIndex < scriptureBooks.length - 1) {
    const n = scriptureBooks[bookIndex + 1]!;
    next = { bookId: n.bookId, chapter: 1, bookName: n.bookName };
  }

  return { prev, next };
}
