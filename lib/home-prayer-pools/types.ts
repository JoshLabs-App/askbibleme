import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

export type HomePrayerManifestV1 = {
  version: 1;
  scopeId: string;
  chunkSize: number;
  entries: { verseKey: string; weight: number; chunkIndex: number }[];
  /** 优先展示的 key 顺序，首屏组批会尽量先从这里取 */
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

export type VerseScopeV1 = { type: "themeRepeat"; minCount: number } | { type: "curated700" };

export type VerseDisplayModeV1 = "primary" | "bilingual";

/** auto: 跟随软件语言；manual: 用户手选主译本（与 App 一致） */
export type HomePrimaryTranslationMode = "auto" | "manual";

/** 金句专页（`verseStyle="goldenVerses"`）正文字体；与首页自然底栏译本偏好同存一份 JSON */
export type GoldenVerseFontFamilyV1 = "sans" | "serif";

/** 金句专页正文字面效果（多层 text-shadow 模拟刻/印；见 `golden-verse-text-effects.ts`） */
export type GoldenVerseTextEffectV1 =
  | "engraved"
  /** 阴刻内凹感（字形上缘吃光、内缘暗影） */
  | "insetCarved"
  | "flat"
  | "letterpress"
  | "softBloom";

export type PrayerMemoryRowV1 = {
  lastShownAt: number;
  intervalMs: number;
  level: number;
};

export type HomePrayerVersePrefsV1 = {
  version: 1;
  verseScope: VerseScopeV1;
  verseDisplay: VerseDisplayModeV1;
  /** 首页经文每节默认停留秒数 */
  homeVerseStableSec: number;
  /** auto: 跟随软件语言；manual: 使用用户手选主译本 */
  primaryTranslationMode: HomePrimaryTranslationMode;
  /** 首页经文中文栏使用的译本 id（须与 `translations.json` / 祷告池 chunk 内键一致） */
  verseTextZhTranslationId: string;
  /** 首页经文英文栏：如 `web-en`（WEB）、`bbe-en`（简易英文） */
  verseTextEnTranslationId: string;
  /** 按范围隔离：如 `explore-curated-700` */
  memoryByNamespace: Record<string, Record<string, PrayerMemoryRowV1>>;
  goldenVerseFontFamily: GoldenVerseFontFamilyV1;
  goldenVerseTextEffect: GoldenVerseTextEffectV1;
};
