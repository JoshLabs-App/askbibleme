import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const READ_BIBLE_TYPOGRAPHY_STORAGE_KEY = "selah_read_bible_typography_v1";

export type ReadBibleSizeId =
  | "xs"
  | "s"
  | "m"
  | "l"
  | "xl"
  | "xxl"
  | "xxxl"
  | "xxxxl"
  | "xxxxxl"
  | "xxxxxxl"
  | "xxxxxxxl"
  | "xxxxxxxxl"
  | "xxxxxxxxxl"
  | "xxxxxxxxxxl"
  | "xxxxxxxxxxxl";

export type ReadBibleTypographyPrefsV1 = {
  size: ReadBibleSizeId;
  verseParagraphFlow: boolean;
  chapterSegmentMode: "default" | "t1";
};

/** 与网站 `read-bible-typography-prefs` rem×16 对齐 */
export type ReadBibleTypographyPx = {
  verseFontSize: number;
  verseLineHeight: number;
  verseNumFontSize: number;
  chapterTitleSize: number;
  heroHe: number;
  heroHeLine: number;
  heroZh: number;
  heroZhLine: number;
  heroEn: number;
  heroEnLine: number;
  catalogBookSize: number;
  catalogBookLine: number;
};

const PX: Record<ReadBibleSizeId, ReadBibleTypographyPx> = {
  xs: {
    verseFontSize: 15,
    verseLineHeight: 26,
    verseNumFontSize: 14,
    chapterTitleSize: 21,
    heroHe: 34,
    heroHeLine: 37,
    heroZh: 23,
    heroZhLine: 26,
    heroEn: 11,
    heroEnLine: 16,
    catalogBookSize: 16,
    catalogBookLine: 22,
  },
  s: {
    verseFontSize: 17,
    verseLineHeight: 29,
    verseNumFontSize: 15,
    chapterTitleSize: 23,
    heroHe: 38,
    heroHeLine: 41,
    heroZh: 26,
    heroZhLine: 29,
    heroEn: 12,
    heroEnLine: 17,
    catalogBookSize: 18,
    catalogBookLine: 24,
  },
  m: {
    verseFontSize: 19,
    verseLineHeight: 33,
    verseNumFontSize: 16,
    chapterTitleSize: 26,
    heroHe: 44,
    heroHeLine: 47,
    heroZh: 30,
    heroZhLine: 33,
    heroEn: 13,
    heroEnLine: 18,
    catalogBookSize: 20,
    catalogBookLine: 26,
  },
  l: {
    verseFontSize: 21,
    verseLineHeight: 36,
    verseNumFontSize: 17,
    chapterTitleSize: 28,
    heroHe: 49,
    heroHeLine: 52,
    heroZh: 33,
    heroZhLine: 37,
    heroEn: 14,
    heroEnLine: 19,
    catalogBookSize: 21,
    catalogBookLine: 27,
  },
  xl: {
    verseFontSize: 24,
    verseLineHeight: 41,
    verseNumFontSize: 18,
    chapterTitleSize: 31,
    heroHe: 54,
    heroHeLine: 58,
    heroZh: 36,
    heroZhLine: 40,
    heroEn: 15,
    heroEnLine: 20,
    catalogBookSize: 22,
    catalogBookLine: 29,
  },
  xxl: {
    verseFontSize: 27,
    verseLineHeight: 46,
    verseNumFontSize: 19,
    chapterTitleSize: 34,
    heroHe: 59,
    heroHeLine: 63,
    heroZh: 39,
    heroZhLine: 44,
    heroEn: 16,
    heroEnLine: 21,
    catalogBookSize: 23,
    catalogBookLine: 30,
  },
  xxxl: {
    verseFontSize: 30,
    verseLineHeight: 51,
    verseNumFontSize: 20,
    chapterTitleSize: 37,
    heroHe: 65,
    heroHeLine: 69,
    heroZh: 44,
    heroZhLine: 49,
    heroEn: 18,
    heroEnLine: 23,
    catalogBookSize: 24,
    catalogBookLine: 32,
  },
  xxxxl: {
    verseFontSize: 34,
    verseLineHeight: 58,
    verseNumFontSize: 21,
    chapterTitleSize: 41,
    heroHe: 72,
    heroHeLine: 76,
    heroZh: 48,
    heroZhLine: 54,
    heroEn: 19,
    heroEnLine: 24,
    catalogBookSize: 25,
    catalogBookLine: 33,
  },
  xxxxxl: {
    verseFontSize: 37,
    verseLineHeight: 63,
    verseNumFontSize: 22,
    chapterTitleSize: 44,
    heroHe: 79,
    heroHeLine: 84,
    heroZh: 54,
    heroZhLine: 60,
    heroEn: 20,
    heroEnLine: 25,
    catalogBookSize: 26,
    catalogBookLine: 34,
  },
  xxxxxxl: {
    verseFontSize: 42,
    verseLineHeight: 71,
    verseNumFontSize: 23,
    chapterTitleSize: 49,
    heroHe: 87,
    heroHeLine: 92,
    heroZh: 60,
    heroZhLine: 66,
    heroEn: 21,
    heroEnLine: 27,
    catalogBookSize: 27,
    catalogBookLine: 35,
  },
  xxxxxxxl: {
    verseFontSize: 46,
    verseLineHeight: 78,
    verseNumFontSize: 24,
    chapterTitleSize: 53,
    heroHe: 95,
    heroHeLine: 100,
    heroZh: 66,
    heroZhLine: 73,
    heroEn: 23,
    heroEnLine: 28,
    catalogBookSize: 28,
    catalogBookLine: 37,
  },
  xxxxxxxxl: {
    verseFontSize: 52,
    verseLineHeight: 88,
    verseNumFontSize: 26,
    chapterTitleSize: 58,
    heroHe: 104,
    heroHeLine: 110,
    heroZh: 72,
    heroZhLine: 80,
    heroEn: 24,
    heroEnLine: 30,
    catalogBookSize: 29,
    catalogBookLine: 38,
  },
  xxxxxxxxxl: {
    verseFontSize: 58,
    verseLineHeight: 98,
    verseNumFontSize: 28,
    chapterTitleSize: 64,
    heroHe: 114,
    heroHeLine: 120,
    heroZh: 80,
    heroZhLine: 88,
    heroEn: 26,
    heroEnLine: 32,
    catalogBookSize: 30,
    catalogBookLine: 40,
  },
  xxxxxxxxxxl: {
    verseFontSize: 64,
    verseLineHeight: 108,
    verseNumFontSize: 30,
    chapterTitleSize: 70,
    heroHe: 124,
    heroHeLine: 130,
    heroZh: 88,
    heroZhLine: 96,
    heroEn: 28,
    heroEnLine: 34,
    catalogBookSize: 31,
    catalogBookLine: 41,
  },
  xxxxxxxxxxxl: {
    verseFontSize: 72,
    verseLineHeight: 120,
    verseNumFontSize: 32,
    chapterTitleSize: 78,
    heroHe: 136,
    heroHeLine: 142,
    heroZh: 96,
    heroZhLine: 106,
    heroEn: 30,
    heroEnLine: 36,
    catalogBookSize: 32,
    catalogBookLine: 42,
  },
};

/** 移动端默认比网站小一档，降低首读时视觉压力 */
export const DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS: ReadBibleTypographyPrefsV1 = {
  size: "m",
  verseParagraphFlow: true,
  chapterSegmentMode: "t1",
};

/** 安卓默认再小一档；两端都能再往下收到 `xs`。 */
export function defaultReadBibleTypographyPrefs(): ReadBibleTypographyPrefsV1 {
  return {
    ...DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS,
    size: Platform.OS === "android" ? "s" : DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS.size,
  };
}

export const READ_BIBLE_SIZE_ORDER: ReadBibleSizeId[] = [
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "xxxl",
  "xxxxl",
  "xxxxxl",
  "xxxxxxl",
  "xxxxxxxl",
  "xxxxxxxxl",
  "xxxxxxxxxl",
  "xxxxxxxxxxl",
  "xxxxxxxxxxxl",
];

/** 一键大字预设：用于读经页设置里的「TT」快速按钮 */
export const READ_BIBLE_SIZE_PRESET_LARGE: ReadBibleSizeId = "xl";

export function readBibleTypographyPx(size: ReadBibleSizeId): ReadBibleTypographyPx {
  return PX[size] ?? PX.m;
}

export function readBibleSizeAtMin(size: ReadBibleSizeId): boolean {
  return size === READ_BIBLE_SIZE_ORDER[0];
}

export function readBibleSizeAtMax(size: ReadBibleSizeId): boolean {
  return size === READ_BIBLE_SIZE_ORDER[READ_BIBLE_SIZE_ORDER.length - 1];
}

export function stepReadBibleSize(size: ReadBibleSizeId, delta: -1 | 1): ReadBibleSizeId {
  const i = READ_BIBLE_SIZE_ORDER.indexOf(size);
  const idx = Math.max(0, Math.min(READ_BIBLE_SIZE_ORDER.length - 1, i + delta));
  return READ_BIBLE_SIZE_ORDER[idx]!;
}

export function parseReadBibleTypographyPrefs(raw: string | null): ReadBibleTypographyPrefsV1 {
  const platformDefault = defaultReadBibleTypographyPrefs();
  if (!raw) return { ...platformDefault };
  try {
    const j = JSON.parse(raw) as {
      size?: unknown;
      verseParagraphFlow?: unknown;
      chapterSegmentMode?: string;
    };
    const size = READ_BIBLE_SIZE_ORDER.includes(j.size as ReadBibleSizeId)
      ? (j.size as ReadBibleSizeId)
      : platformDefault.size;
    return {
      size,
      verseParagraphFlow:
        typeof j.verseParagraphFlow === "boolean"
          ? j.verseParagraphFlow
          : platformDefault.verseParagraphFlow,
      chapterSegmentMode: (() => {
        const rawMode = j.chapterSegmentMode;
        if (rawMode === "t1" || rawMode === "t2" || rawMode === "story") return "t1";
        if (rawMode === "default") return "default";
        return platformDefault.chapterSegmentMode;
      })(),
    };
  } catch {
    return { ...platformDefault };
  }
}

export async function readReadBibleTypographyPrefs(): Promise<ReadBibleTypographyPrefsV1> {
  try {
    const raw = await AsyncStorage.getItem(READ_BIBLE_TYPOGRAPHY_STORAGE_KEY);
    return parseReadBibleTypographyPrefs(raw);
  } catch {
    return { ...defaultReadBibleTypographyPrefs() };
  }
}

export async function writeReadBibleTypographyPrefs(prefs: ReadBibleTypographyPrefsV1): Promise<void> {
  const size = READ_BIBLE_SIZE_ORDER.includes(prefs.size)
    ? prefs.size
    : defaultReadBibleTypographyPrefs().size;
  await AsyncStorage.setItem(
    READ_BIBLE_TYPOGRAPHY_STORAGE_KEY,
    JSON.stringify({
      size,
      verseParagraphFlow: prefs.verseParagraphFlow === true,
      chapterSegmentMode: prefs.chapterSegmentMode === "t1" ? "t1" : "default",
    }),
  );
}
