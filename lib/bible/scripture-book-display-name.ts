import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";

export function getScriptureBookDisplayName(bookId: string, locale: AppLocale): string {
  if (locale === "en") {
    return SCRIPTURE_BOOK_NAME_EN[bookId] ?? bookId;
  }
  const name = scriptureBooks.find((b) => b.bookId === bookId)?.bookName ?? bookId;
  return locale === "zh-TW" ? toZhTwText(name) : name;
}
