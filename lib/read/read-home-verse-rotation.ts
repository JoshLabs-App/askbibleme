import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import type { AppLocale } from "@/lib/i18n/config";

export const READ_HOME_VERSE_ROTATION = [
  { bookId: "JHN", chapter: 3, verse: 16 },
  { bookId: "LUK", chapter: 19, verse: 10 },
  { bookId: "1TI", chapter: 1, verse: 15 },
  { bookId: "2CO", chapter: 5, verse: 19 },
  { bookId: "ROM", chapter: 6, verse: 23 },
  { bookId: "JHN", chapter: 20, verse: 31 },
] as const;

export type ReadHomeVerseItem = {
  text: string;
  reference: string;
};

export async function loadReadHomeVerses(
  cwd: string,
  opts: { locale: AppLocale; translationId: string },
): Promise<ReadHomeVerseItem[]> {
  const index = readTranslationsIndexSync(cwd);
  const meta = index.translations.find((tr) => tr.id === opts.translationId);
  const versionLabel = (opts.locale === "en" ? meta?.labelEn : meta?.labelZh)?.trim() ?? "";

  const items = await Promise.all(
    READ_HOME_VERSE_ROTATION.map(async (ref) => {
      const loaded = await loadChapterFromTranslation(cwd, ref.bookId, ref.chapter, opts.translationId);
      const bookName = loaded?.bookName ?? getScriptureBookDisplayName(ref.bookId, opts.locale);
      const verseText = loaded?.verses.find((row) => row.verse === ref.verse)?.text.trim() ?? "";
      const reference = `${bookName} ${ref.chapter}:${ref.verse}${versionLabel ? ` · ${versionLabel}` : ""}`;
      return { text: verseText, reference };
    }),
  );

  return items.filter((row) => row.text.length > 0);
}
