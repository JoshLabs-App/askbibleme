import type { HomeVerseEntry } from "./verse-pool/types";

export type HomeVerseDisplayState = {
  entry: HomeVerseEntry | null;
  contrastEntry: HomeVerseEntry | null;
  verseKey: string | null | undefined;
  primaryTranslationId: string;
  contrastTranslationId: string;
};

type VerseSnapshot = {
  ready: boolean;
  entry: HomeVerseEntry | null;
  contrastEntry: HomeVerseEntry | null;
  verseKey: string | null | undefined;
  primaryTranslationId: string;
  contrastTranslationId: string;
};

/** 首页经文展示：直接跟轮播数据同步，无淡入淡出。 */
export function useHomeVerseOverlayFade({
  entry,
  contrastEntry,
  verseKey,
  primaryTranslationId,
  contrastTranslationId,
}: VerseSnapshot) {
  const displayVerse: HomeVerseDisplayState = {
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId,
    contrastTranslationId,
  };

  return {
    displayVerse,
    effectiveEntry: entry,
    effectiveContrastEntry: contrastEntry,
    effectiveVerseKey: verseKey,
    effectivePrimaryTranslationId: primaryTranslationId,
    effectiveContrastTranslationId: contrastTranslationId,
  };
}
