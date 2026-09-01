import { scriptureBooks } from "@/lib/bible/scripture-books";

export function getNextScriptureChapter(
  bookId: string,
  chapter: number,
): { bookId: string; chapter: number } | null {
  const id = String(bookId || "").trim().toUpperCase();
  const idx = scriptureBooks.findIndex((b) => b.bookId === id);
  if (idx < 0 || !Number.isInteger(chapter) || chapter < 1) return null;

  const meta = scriptureBooks[idx]!;
  if (chapter < meta.chapters) {
    return { bookId: id, chapter: chapter + 1 };
  }
  if (idx + 1 >= scriptureBooks.length) return null;
  const next = scriptureBooks[idx + 1]!;
  return { bookId: next.bookId, chapter: 1 };
}

export function getNextScriptureChapterInBook(
  bookId: string,
  chapter: number,
): { bookId: string; chapter: number } | null {
  const id = String(bookId || "").trim().toUpperCase();
  const meta = scriptureBooks.find((b) => b.bookId === id);
  if (!meta || !Number.isInteger(chapter) || chapter < 1) return null;
  const nextCh = chapter < meta.chapters ? chapter + 1 : 1;
  return { bookId: id, chapter: nextCh };
}
