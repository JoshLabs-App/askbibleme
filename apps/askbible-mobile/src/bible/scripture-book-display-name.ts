import { getLocale } from "../i18n/locale-store";
import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";

export function getScriptureBookDisplayName(
  bookId: string,
  locale: AppLocale = getLocale(),
): string {
  if (locale === "en") {
    return SCRIPTURE_BOOK_NAME_EN[bookId] ?? bookId;
  }
  const zhName = scriptureBooks.find((b) => b.bookId === bookId)?.bookName ?? bookId;
  return locale === "zh-TW" ? toZhTwText(zhName) : zhName;
}
