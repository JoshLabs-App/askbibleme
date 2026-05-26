import { cookies, headers } from "next/headers";
import {
  loadChapterFromTranslation,
  type LoadedChapter,
} from "@/lib/bible/load-chapter-from-default-translation";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import {
  loadChapterSegmentsFromLocalDataset,
  loadChapterSegmentsFromOpenUsfm,
} from "@/lib/bible/load-chapter-segments";
import { resolveReadBibleTranslationPrefsFromCookies } from "@/lib/read/read-bible-translation-prefs";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";

export type ReadChapterWithContrast = {
  primary: LoadedChapter;
  contrast: LoadedChapter | null;
};

/** 读经章页：按 Cookie / 默认读本加载主译本，可选对照译本。 */
export async function loadReadChapterForReadPage(
  bookId: string,
  chapter: number,
): Promise<ReadChapterWithContrast | null> {
  const cwd = process.cwd();
  const index = readTranslationsIndexSync(cwd);
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const prefs = resolveReadBibleTranslationPrefsFromCookies(cookieStore, index, locale);

  const primary = await loadChapterFromTranslation(
    cwd,
    bookId,
    chapter,
    prefs.primaryTranslationId,
  );
  if (!primary) return null;

  let contrast: LoadedChapter | null = null;
  if (prefs.contrastTranslationId) {
    contrast = await loadChapterFromTranslation(
      cwd,
      bookId,
      chapter,
      prefs.contrastTranslationId,
    );
  }

  const primaryMaxVerse = primary.verses.reduce((max, row) => Math.max(max, row.verse), 0) || null;
  primary.segments =
    loadChapterSegmentsFromLocalDataset(cwd, primary.bookId, primary.chapter) ??
    (await loadChapterSegmentsFromOpenUsfm(primary.bookId, primary.chapter, primaryMaxVerse));

  return { primary, contrast };
}
