import type { AppLocale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { translate } from "@/lib/i18n/translate";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { scriptureBookNotes } from "@/lib/bible/scripture-book-notes";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { ScriptureCanonCatalogSection } from "@/lib/bible/read-scripture-canon-catalog";

type RawSection = {
  sectionId: string;
  order: number;
  title: string;
  taglines?: string[];
  bookIds: string[];
};

type CatalogFile = { sections: RawSection[] };

import catalogRaw from "../../data/bible/scripture_canon_catalog.json";

const raw = catalogRaw as CatalogFile;
const booksById = new Map(scriptureBooks.map((b) => [b.bookId, b]));
const notesByBookId = new Map(scriptureBookNotes.map((n) => [n.bookId, n]));

function sectionTitle(sectionId: string, zhTitle: string, locale: AppLocale): string {
  if (locale === "zh-CN") return zhTitle;
  if (locale === "zh-TW") return toZhTwText(zhTitle);
  const key = `pages.read.canonSections.${sectionId}.title`;
  const hit = translate(MESSAGES[locale], key);
  return hit === key ? zhTitle : hit;
}

/** 客户端正典目录（对齐 App `canonCatalog.ts`） */
export function getScriptureCanonCatalogSectionsClient(locale: AppLocale): ScriptureCanonCatalogSection[] {
  return [...raw.sections]
    .sort((a, b) => a.order - b.order)
    .map((sec) => ({
      sectionId: sec.sectionId,
      order: sec.order,
      title: sectionTitle(sec.sectionId, sec.title, locale),
      taglines:
        locale === "en"
          ? []
          : (sec.taglines || []).map((line) => String(line).trim()).filter(Boolean),
      books: sec.bookIds.map((bookId) => {
        const book = booksById.get(bookId);
        const note = notesByBookId.get(bookId);
        if (!book || !note) {
          throw new Error(`[canon-client] missing book or note: ${bookId}`);
        }
        return {
          bookId: book.bookId,
          bookNumber: book.bookNumber,
          bookName: getScriptureBookDisplayName(book.bookId, locale),
          divine: String(note.spiritualFrame?.divine ?? "").trim(),
          summary: String(note.summary || "").trim(),
        };
      }),
    }));
}
