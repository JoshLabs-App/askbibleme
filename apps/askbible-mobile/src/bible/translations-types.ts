/** 与 `lib/bible/translations-types.ts` 对齐（移动端译本目录） */
export type BibleTranslationMeta = {
  id: string;
  labelZh: string;
  labelEn: string;
  language: string;
};

export type BibleTranslationsIndex = {
  translations: BibleTranslationMeta[];
  defaultTranslationId: string | null;
};
