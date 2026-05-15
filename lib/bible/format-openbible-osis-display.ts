import type { AppLocale } from "@/lib/i18n/config";
import { formatVerseRefFootnote } from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { lookupOpenbibleOsisBookToken, parseOpenbibleOsisToVerseSpan } from "@/lib/bible/osis-openbible-book";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";
import { scriptureBooks } from "@/lib/bible/scripture-books";

/**
 * 将 OpenBible OSIS 片段格式化为界面语言下的「书卷名 章:节」可读串。
 * 若无法解析为单章连续范围，则逐段替换书卷缩写（仍保留原文标点结构）。
 */
export function formatOpenbibleOsisForLocale(osis: string, locale: AppLocale): string {
  const raw = osis.trim();
  if (!raw) return "";

  const span = parseOpenbibleOsisToVerseSpan(raw);
  if (span) {
    const ref: VerseRef = {
      bookId: span.bookId,
      chapter: span.chapter,
      verseStart: span.verseStart,
      verseEnd: span.verseEnd,
    };
    const foot = formatVerseRefFootnote(ref, locale);
    if (foot) return foot;
  }

  const normalized = raw.replace(/\u2013|\u2014/g, "-");
  return normalized.replace(/(\d?[A-Za-z]+)\.(\d+)\.(\d+)/g, (full, bookTok: string, ch: string, vs: string) => {
    const id = lookupOpenbibleOsisBookToken(bookTok);
    if (!id) return full;
    if (locale === "zh-CN") {
      const b = scriptureBooks.find((x) => x.bookId === id);
      return b ? `${b.bookName} ${ch}:${vs}` : full;
    }
    const en = SCRIPTURE_BOOK_NAME_EN[id] ?? id;
    return `${en} ${ch}:${vs}`;
  });
}
