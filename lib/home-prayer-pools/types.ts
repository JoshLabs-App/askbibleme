import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

export type HomePrayerManifestV1 = {
  version: 1;
  scopeId: string;
  chunkSize: number;
  entries: { verseKey: string; weight: number; chunkIndex: number }[];
  /** 仅 `all`：优先展示的 key 顺序（短、鼓励向在前），首屏组批会尽量先从这里取 */
  bootstrapVerseKeys?: string[];
};

export type HomePrayerChunkVerseV1 = {
  verseKey: string;
  weight: number;
  locales: Record<AppLocale, HomeVerseEntry>;
  /** 生成脚本写入：同一节在多种译本下的正文，供用户偏好切换 */
  byTranslationId?: Record<string, HomeVerseEntry>;
};

export type HomePrayerChunkV1 = {
  version: 1;
  scopeId: string;
  chunkIndex: number;
  verses: HomePrayerChunkVerseV1[];
};

export type VerseScopeV1 = { type: "all" } | { type: "category"; categoryId: string };

export type VerseDisplayModeV1 = "primary" | "bilingual";

export type PrayerMemoryRowV1 = {
  lastShownAt: number;
  intervalMs: number;
  level: number;
};

export type HomePrayerVersePrefsV1 = {
  version: 1;
  verseScope: VerseScopeV1;
  verseDisplay: VerseDisplayModeV1;
  /** 首页经文中文栏使用的译本 id（须与 `translations.json` / 祷告池 chunk 内键一致） */
  verseTextZhTranslationId: string;
  /** 首页经文英文栏：如 `web-en`（WEB）、`bbe-en`（简易英文） */
  verseTextEnTranslationId: string;
  /** 按范围隔离：`all` 或 `cat:<categoryId>` */
  memoryByNamespace: Record<string, Record<string, PrayerMemoryRowV1>>;
};
