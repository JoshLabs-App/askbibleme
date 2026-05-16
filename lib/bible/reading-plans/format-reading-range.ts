import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";

const bookNameById = new Map(scriptureBooks.map((b) => [b.bookId, b.bookName]));

export function formatReadingPlanRange(r: ReadingPlanRange): string {
  const name = bookNameById.get(r.bookId) ?? r.bookId;
  const { startChapter, endChapter, startVerse, endVerse } = r;
  if (startChapter === endChapter) {
    if (startVerse != null && endVerse != null) {
      if (startVerse === endVerse) return `${name} ${startChapter}:${startVerse}`;
      return `${name} ${startChapter}:${startVerse}–${endVerse}`;
    }
    return `${name} ${startChapter}`;
  }
  if (startVerse != null && endVerse != null) {
    return `${name} ${startChapter}:${startVerse}–${endChapter}:${endVerse}`;
  }
  return `${name} ${startChapter}–${endChapter}`;
}

export function readingPlanChapterHref(bookId: string, chapter: number): string {
  return `/read/${encodeURIComponent(bookId)}/${chapter}`;
}
