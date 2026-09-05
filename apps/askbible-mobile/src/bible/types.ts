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
  /** 主译本缺本章（如 UST 未发布书卷）而回退时：用户原选译本 id 与名称；正常加载为空。 */
  fallbackFromTranslationId?: string | null;
  fallbackFromLabelZh?: string;
  fallbackFromLabelEn?: string;
};

export const DEFAULT_SCRIPTURE_TRANSLATION_ID = "cuv-simp";

export const DEFAULT_SCRIPTURE_LABEL_ZH = "和合本（简体）";

export const DEFAULT_SCRIPTURE_LABEL_EN = "Chinese Union Version (Simplified)";
