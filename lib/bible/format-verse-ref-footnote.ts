import type { AppLocale } from "@/lib/i18n/config";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";
import type { VerseRef } from "@/lib/bible/verse-ref";

function verseRangeSuffix(verseStart: number, verseEnd: number): string {
  if (verseStart === verseEnd) return `${verseStart}`;
  return `${verseStart}–${verseEnd}`;
}

export function formatVerseRefFootnote(ref: VerseRef, locale: AppLocale): string | null {
  const bookId = String(ref.bookId || "").trim().toUpperCase();
  const bookZh = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookZh) return null;
  const ch = ref.chapter;
  const suffix = verseRangeSuffix(ref.verseStart, ref.verseEnd);
  if (locale === "zh-CN") {
    return `${bookZh.bookName} ${ch}:${suffix}`;
  }
  const enName = SCRIPTURE_BOOK_NAME_EN[bookId] ?? bookId;
  return `${enName} ${ch}:${suffix}`;
}
