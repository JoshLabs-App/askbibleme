import { getLocale } from "../i18n/locale-store";
import type { AppLocale } from "../i18n/config";
import { scriptureBooks } from "./scripture-books";
import { SCRIPTURE_BOOK_NAME_EN } from "./scripture-book-names-en";

export function getScriptureBookDisplayName(
  bookId: string,
  locale: AppLocale = getLocale(),
): string {
  if (locale === "en") {
    return SCRIPTURE_BOOK_NAME_EN[bookId] ?? bookId;
  }
  return scriptureBooks.find((b) => b.bookId === bookId)?.bookName ?? bookId;
}
