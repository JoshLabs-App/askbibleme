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
  defaultTranslationId: string | null;
};
