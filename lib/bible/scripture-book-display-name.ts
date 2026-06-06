import type { AppLocale } from "@/lib/i18n/config";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";

export function getScriptureBookDisplayName(bookId: string, locale: AppLocale): string {
  if (locale === "en") {
    return SCRIPTURE_BOOK_NAME_EN[bookId] ?? bookId;
  }
  return scriptureBooks.find((b) => b.bookId === bookId)?.bookName ?? bookId;
}
