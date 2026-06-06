import { getScriptureBookDisplayName } from "../../bible/scripture-book-display-name";
import { getLocale } from "../../i18n/locale-store";
import type { AppLocale } from "../../i18n/config";
import type { ReadingPlanRange } from "./types";

export function formatReadingPlanRange(r: ReadingPlanRange, locale: AppLocale = getLocale()): string {
  const name = getScriptureBookDisplayName(r.bookId, locale);
  const { startChapter, endChapter, startVerse, endVerse } = r;

  if (startChapter === endChapter) {
    if (startVerse != null && endVerse != null) {
      if (startVerse === endVerse) return `${name} ${startChapter}:${startVerse}`;
      return `${name} ${startChapter}:${startVerse}–${endVerse}`;
    }
    if (locale === "en") return `${name} ${startChapter}`;
    return `${name} ${startChapter}${r.bookId === "PSA" ? "篇" : "章"}`;
  }
  if (startVerse != null && endVerse != null) {
    return `${name} ${startChapter}:${startVerse}–${endChapter}:${endVerse}`;
  }
  if (locale === "en") return `${name} ${startChapter}–${endChapter}`;
  return `${name} ${startChapter}–${endChapter}章`;
}
