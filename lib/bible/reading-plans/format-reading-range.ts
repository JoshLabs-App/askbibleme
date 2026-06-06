import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { AppLocale } from "@/lib/i18n/config";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";

const bookNameById = new Map(scriptureBooks.map((b) => [b.bookId, b.bookName]));

export function formatReadingPlanRange(r: ReadingPlanRange, locale?: AppLocale): string {
  const name = locale ? getScriptureBookDisplayName(r.bookId, locale) : bookNameById.get(r.bookId) ?? r.bookId;
  const { startChapter, endChapter, startVerse, endVerse } = r;
  if (startChapter === endChapter) {
    if (startVerse != null && endVerse != null) {
      if (startVerse === endVerse) return `${name} ${startChapter}:${startVerse}`;
      return `${name} ${startChapter}:${startVerse}–${endVerse}`;
    }
    if (locale === "en") return `${name} ${startChapter}`;
    if (locale) return `${name} ${startChapter}${r.bookId === "PSA" ? "篇" : "章"}`;
    return `${name} ${startChapter}`;
  }
  if (startVerse != null && endVerse != null) {
    return `${name} ${startChapter}:${startVerse}–${endChapter}:${endVerse}`;
  }
  if (locale === "en") return `${name} ${startChapter}–${endChapter}`;
  if (locale) return `${name} ${startChapter}–${endChapter}章`;
  return `${name} ${startChapter}–${endChapter}`;
}

export function readingPlanChapterHref(bookId: string, chapter: number, planFlow?: boolean): string {
  const base = `/read/${encodeURIComponent(bookId)}/${chapter}`;
  return planFlow ? `${base}?planFlow=1` : base;
}
