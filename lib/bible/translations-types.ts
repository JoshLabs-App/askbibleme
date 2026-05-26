export type BibleTranslationMeta = {
  id: string;
  labelZh: string;
  labelEn: string;
  /** BCP47 风格，如 zh-Hans、en */
  language: string;
  /** 相对 `data/bible/` 的路径，如 uploads/cuv.json */
  sourceFile: string;
  updatedAt: string;
  bytes: number;
  verseCount: number;
};

export type BibleTranslationsIndex = {
  translations: BibleTranslationMeta[];
  /** 前台默认译本 id；可为空 */
  defaultTranslationId: string | null;
};

export const SELAH_BIBLE_FORMAT = "selah-bible-v1";
export const DEFAULT_SCRIPTURE_TRANSLATION_ID = "cuv-simp";
