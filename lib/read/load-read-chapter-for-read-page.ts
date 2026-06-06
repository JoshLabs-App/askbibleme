import { cookies, headers } from "next/headers";
import {
  loadChapterFromTranslation,
  type LoadedChapter,
} from "@/lib/bible/load-chapter-from-default-translation";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { loadBundledChapterSegments } from "@/lib/bible/bundled-chapter-segments";
import {
  loadChapterSegmentsFromLocalDataset,
  loadChapterSegmentsFromOpenUsfm,
} from "@/lib/bible/load-chapter-segments";
import { resolveReadBibleTranslationPrefsFromCookies } from "@/lib/read/read-bible-translation-prefs";
import { DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS } from "@/lib/read/read-bible-typography-prefs";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";

export type ReadChapterContrastLoaded = {
  translationId: string;
  chapter: LoadedChapter;
};

export type ReadChapterWithContrast = {
  primary: LoadedChapter;
  /** @deprecated 首项对照；请用 `contrasts` */
  contrast: LoadedChapter | null;
  contrasts: ReadChapterContrastLoaded[];
};

/** 读经章页：按 Cookie / 默认读本加载主译本，可选多个对照译本。 */
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

  const contrasts: ReadChapterContrastLoaded[] = [];
  for (const contrastId of prefs.contrastTranslationIds) {
    const loaded = await loadChapterFromTranslation(cwd, bookId, chapter, contrastId);
    if (loaded) contrasts.push({ translationId: contrastId, chapter: loaded });
  }

  const primaryMaxVerse = primary.verses.reduce((max, row) => Math.max(max, row.verse), 0) || null;
  primary.segments =
    loadBundledChapterSegments(
      cwd,
      primary.bookId,
      primary.chapter,
      DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS.chapterSegmentMode,
    ) ??
    loadChapterSegmentsFromLocalDataset(cwd, primary.bookId, primary.chapter) ??
    (await loadChapterSegmentsFromOpenUsfm(primary.bookId, primary.chapter, primaryMaxVerse));

  return {
    primary,
    contrast: contrasts[0]?.chapter ?? null,
    contrasts,
  };
}
