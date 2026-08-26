import { divineLabelForLocale } from "../bible/scripture-book-divine-en";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { summaryLabelForLocale } from "../bible/scripture-book-summary-en";
import { scriptureBooks, OLD_TESTAMENT_MAX_BOOK_NUMBER } from "../bible/scripture-books";
import { scriptureBookNotes } from "../bible/scripture-book-notes";
import type { AppLocale } from "../i18n/config";
import { getLocale } from "../i18n/locale-store";
import { createT, toZhTwText } from "../i18n/site-copy";

export type ScriptureCanonCatalogBook = {
  bookId: string;
  bookNumber: number;
  bookName: string;
  divine: string;
  summary: string;
};

export type ScriptureCanonCatalogSection = {
  sectionId: string;
  order: number;
  title: string;
  taglines: string[];
  books: ScriptureCanonCatalogBook[];
};

type RawSection = {
  sectionId: string;
  order: number;
  title: string;
  taglines?: string[];
  bookIds: string[];
};

type CatalogFile = { sections: RawSection[] };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require("../../assets/content/scripture_canon_catalog.json") as CatalogFile;

const booksById = new Map(scriptureBooks.map((b) => [b.bookId, b]));
const notesByBookId = new Map(scriptureBookNotes.map((n) => [n.bookId, n]));

function canonSectionTitle(sectionId: string, zhTitle: string, locale: AppLocale): string {
  // 跟读经展示语言走（主译本），不要用 App 全局 t()。
  if (locale === "zh-CN") return zhTitle;
  if (locale === "zh-TW") return toZhTwText(zhTitle);
  const key = `pages.read.canonSections.${sectionId}.title`;
  const hit = createT(locale)(key);
  return hit === key ? zhTitle : hit;
}

function buildBook(bookId: string, locale: AppLocale): ScriptureCanonCatalogBook {
  const book = booksById.get(bookId);
  const note = notesByBookId.get(bookId);
  if (!book || !note) {
    throw new Error(`[canon] missing book or note: ${bookId}`);
  }
  const zhDivine = String(note.spiritualFrame?.divine ?? "").trim();
  if (!zhDivine) {
    throw new Error(`[canon] missing divine for ${bookId}`);
  }
  const divine = divineLabelForLocale(bookId, zhDivine, locale);
  return {
    bookId: book.bookId,
    bookNumber: book.bookNumber,
    bookName: getScriptureBookDisplayName(book.bookId, locale),
    divine,
    summary: summaryLabelForLocale(book.bookId, String(note.summary || "").trim(), locale),
  };
}

let cachedSections: { locale: AppLocale; sections: ScriptureCanonCatalogSection[] } | null = null;

export function getScriptureCanonCatalogSections(
  displayLocale: AppLocale = getLocale(),
): ScriptureCanonCatalogSection[] {
  const locale = displayLocale;
  if (cachedSections?.locale === locale) return cachedSections.sections;
  const sections = [...raw.sections]
    .sort((a, b) => a.order - b.order)
    .map((sec) => ({
      sectionId: sec.sectionId,
      order: sec.order,
      title: canonSectionTitle(sec.sectionId, sec.title, locale),
      taglines:
        locale === "en"
          ? []
          : (sec.taglines || [])
              .map((line) => {
                const trimmed = String(line).trim();
                if (!trimmed) return "";
                return locale === "zh-TW" ? toZhTwText(trimmed) : trimmed;
              })
              .filter(Boolean),
      books: sec.bookIds.map((id) => buildBook(id, locale)),
    }));
  cachedSections = { locale, sections };
  return sections;
}

export function bookNameForId(bookId: string, displayLocale: AppLocale = getLocale()): string {
  return getScriptureBookDisplayName(bookId, displayLocale);
}

export function chaptersForBookId(bookId: string): number {
  return booksById.get(bookId)?.chapters ?? 0;
}

export function testamentForSection(section: ScriptureCanonCatalogSection): "old" | "new" {
  const n = section.books[0]?.bookNumber;
  if (typeof n !== "number") return "old";
  return n <= OLD_TESTAMENT_MAX_BOOK_NUMBER ? "old" : "new";
}

export function groupCanonSectionsByTestament(sections: ScriptureCanonCatalogSection[]) {
  type Group = { testament: "old" | "new"; sections: ScriptureCanonCatalogSection[] };
  const groups: Group[] = [];
  for (const sec of sections) {
    const t = testamentForSection(sec);
    const prev = groups[groups.length - 1];
    if (prev && prev.testament === t) {
      prev.sections.push(sec);
    } else {
      groups.push({ testament: t, sections: [sec] });
    }
  }
  return groups;
}
