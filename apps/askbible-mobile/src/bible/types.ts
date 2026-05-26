import type { VerseSpeechPart } from "./verse-annotations";

export type LoadedChapterVerse = {
  verse: number;
  text: string;
  speechParts: VerseSpeechPart[] | null;
  themeRepeatCount: number;
  isGolden: boolean;
};

export type ChapterSegmentType = "heading" | "paragraph" | "poetry" | "break";

export type ChapterSegment = {
  id: string;
  type: ChapterSegmentType;
  marker: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  title?: string;
  titleZh?: string;
};

export type LoadedChapter = {
  translationId: string;
  labelZh: string;
  labelEn: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: LoadedChapterVerse[];
};

export const DEFAULT_SCRIPTURE_TRANSLATION_ID = "cuv-simp";

export const DEFAULT_SCRIPTURE_LABEL_ZH = "和合本（简体）";

export const DEFAULT_SCRIPTURE_LABEL_EN = "Chinese Union Version (Simplified)";
