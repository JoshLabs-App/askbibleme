/**
 * 成就系统的网页端目录表。
 *
 * 真源是 `data/medals.json`（DECISIONS「成就系统：复用 MY CLASS 勋章图」），iOS / 安卓两端由
 * `npm run gen:medals` 生成 Swift / Kotlin 表；网页端不生成，直接 import 同一份 JSON——
 * 少一份生成物要对拍，数值天然不会跑偏。
 */
import medals from "@/data/medals.json";

export type MedalMetric =
  | "chaptersOpened"
  | "chaptersRead"
  | "readingDays"
  | "streakDays"
  | "favorites"
  | "sameBookStreak"
  | "listenHours"
  | "listenHoursThisMonth"
  | "morningDays"
  | "nightDays"
  | "booksCompleted"
  | "otBooksCompleted"
  | "ntBooksCompleted"
  | "bothTestaments"
  | "fullWeeks"
  | "planDays";

export type MedalText = { zh: string; en: string };

export type MedalDef = {
  key: string;
  category: string;
  metric: MedalMetric;
  tiers: number[];
  name: MedalText;
  condition: MedalText;
  unit?: MedalText;
};

export const MEDAL_CATALOG: MedalDef[] = medals.medals as MedalDef[];

export const MEDAL_SEAL_FILES: string[] = medals.seals.files;

/** 66 卷印章按正典顺序，第 n 卷（1 起）对应 MEDAL_SEAL_FILES[n - 1] */
export function sealKeyForBookNumber(bookNumber: number): string | null {
  return MEDAL_SEAL_FILES[bookNumber - 1] ?? null;
}

/** 勋章图基址：和项目其它素材一致走 r2.dev 公网域 */
export const MEDAL_IMAGE_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/medals/";

export function medalImageUrl(key: string): string {
  return `${MEDAL_IMAGE_BASE}${key}.webp`;
}

export const MEDAL_XP = {
  perVerseRead: medals.xp.perVerseRead,
  perListenTick: medals.xp.perListenTick,
  listenTickSeconds: medals.xp.listenTickSeconds,
  listenTicksPerChapterCap: medals.xp.listenTicksPerChapterCap,
  perChapterRead: medals.xp.perChapterRead,
  perBookCompleted: medals.xp.perBookCompleted,
  perReadingDay: medals.xp.perReadingDay,
  firstOpenOfDay: medals.xp.firstOpenOfDay,
  perFavorite: medals.xp.perFavorite,
  perHighlight: medals.xp.perHighlight,
  perPlanDay: medals.xp.perPlanDay,
  perMedalTier: medals.xp.perMedalTier,
  perSeal: medals.xp.perSeal,
  streakPerDay: medals.xp.streakMultiplier.perDay,
  streakCap: medals.xp.streakMultiplier.cap,
  comboStep: medals.xp.combo.step,
  comboCap: medals.xp.combo.cap,
} as const;

const THRESHOLDS: number[] = medals.levels.thresholds;
const LEVEL_STEP: number = medals.levels.step;
const TITLES: MedalText[] = medals.levels.titles;

/** 满 12 级后每 step XP 一级，称号保持最后一个（与 Swift / Kotlin 版一致） */
export const MedalLevels = {
  level(xp: number): number {
    let lv = 1;
    for (let i = 0; i < THRESHOLDS.length; i += 1) {
      if (xp >= THRESHOLDS[i]) lv = i + 1;
    }
    if (xp >= THRESHOLDS[THRESHOLDS.length - 1]) {
      const over = xp - THRESHOLDS[THRESHOLDS.length - 1];
      lv = THRESHOLDS.length + Math.floor(over / LEVEL_STEP);
    }
    return lv;
  },
  /** 该等级的起始 XP */
  floor(level: number): number {
    if (level <= THRESHOLDS.length) return THRESHOLDS[Math.max(0, level - 1)];
    return THRESHOLDS[THRESHOLDS.length - 1] + (level - THRESHOLDS.length) * LEVEL_STEP;
  },
  /** 下一级的门槛 */
  ceiling(level: number): number {
    return MedalLevels.floor(level + 1);
  },
  title(level: number): MedalText {
    return TITLES[Math.min(Math.max(1, level), TITLES.length) - 1];
  },
};
