import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import type { BibleTranslationMeta } from "../bible/translations-types";
import type { ReadBibleTypographyPrefsV1, ReadBibleTypographyPx } from "./read-bible-typography-prefs";
import type { ReadBibleTranslationPrefsV1 } from "./read-bible-translation-prefs";
import { createContext } from "react";

export type ReadBibleTypographyContextValue = {
  typography: ReadBibleTypographyPrefsV1;
  px: ReadBibleTypographyPx;
  verseParagraphFlow: boolean;
  setVerseParagraphFlow: (enabled: boolean) => void;
  chapterSegmentMode: "default" | "t1";
  setChapterSegmentMode: (mode: "default" | "t1") => void;
  sizeAtLargePreset: boolean;
  setSizeToLargePreset: () => void;
  sizeAtMin: boolean;
  sizeAtMax: boolean;
  sizeAtDefault: boolean;
  bumpSize: (delta: -1 | 1) => void;
  resetSizeToDefault: () => void;
  audioVoiceId: CuvChapterAudioVoiceId;
  setAudioVoiceId: (id: CuvChapterAudioVoiceId) => Promise<void>;
  translation: ReadBibleTranslationPrefsV1;
  translationCatalog: BibleTranslationMeta[];
  translationCatalogReady: boolean;
  refreshTranslationCatalog: () => Promise<void>;
  primaryTranslationId: string;
  contrastTranslationIds: string[];
  contrastTranslationId: string | null;
  audioTranslationId: string | null;
  chapterAudioTranslationId: string;
  setPrimaryTranslationId: (id: string) => Promise<void>;
  setContrastTranslationIds: (ids: string[]) => Promise<void>;
  setContrastTranslationId: (id: string | null) => Promise<void>;
  setAudioTranslationId: (id: string | null) => Promise<void>;
};

export const ReadBibleTypographyContext = createContext<ReadBibleTypographyContextValue | null>(null);
