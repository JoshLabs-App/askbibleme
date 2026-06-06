/** 与 `lib/bible/translations-types.ts` 对齐（移动端译本目录） */
export type BibleTranslationMeta = {
  id: string;
  labelZh: string;
  labelEn: string;
  language: string;
  /** 是否随 App 安装包内置 */
  bundled?: boolean;
  /** SQLite 体积（字节）；线上目录返回 */
  bytes?: number;
  /** 非内置译本的下载路径（相对站点根） */
  downloadUrl?: string | null;
};

export type BibleTranslationsIndex = {
  translations: BibleTranslationMeta[];
  defaultTranslationId: string | null;
};
