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
  /** 译本来源；未填时视为本地安装包或本地磁盘译本。 */
  provider?: "local" | "youversion" | "api-bible" | "esv";
  /** 远端版本标识，如 YouVersion 版本 id 或 API.Bible abbreviation。 */
  remoteId?: string | null;
  /** 交付方式。 */
  delivery?: "bundled" | "local-download" | "chapter-api";
  /** 是否启用；用于撤销授权或临时下线。 */
  enabled?: boolean;
  /** 版权声明或归属说明。 */
  copyright?: string | null;
  /** 发布方或版权方链接。 */
  publisherUrl?: string | null;
};

export type BibleTranslationsIndex = {
  translations: BibleTranslationMeta[];
  /** 前台默认译本 id；可为空 */
  defaultTranslationId: string | null;
};

export const SELAH_BIBLE_FORMAT = "selah-bible-v1";
export const DEFAULT_SCRIPTURE_TRANSLATION_ID = "cuv-simp";
