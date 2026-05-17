import { cookies } from "next/headers";
import {
  loadChapterFromTranslation,
  type LoadedChapter,
} from "@/lib/bible/load-chapter-from-default-translation";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { resolveReadBibleTranslationPrefsFromCookies } from "@/lib/read/read-bible-translation-prefs";

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
  const prefs = resolveReadBibleTranslationPrefsFromCookies(cookieStore, index);

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

  return { primary, contrast };
}
