export const READ_BIBLE_TYPOGRAPHY_STORAGE_KEY = "selah_read_bible_typography_v1";

export type ReadBibleSizeId =
  | "s"
  | "m"
  | "l"
  | "xl"
  | "xxl"
  | "xxxl"
  | "xxxxl"
  | "xxxxxl"
  | "xxxxxxl"
  | "xxxxxxxl";

export type ReadBibleTypographyPrefsV1 = {
  size: ReadBibleSizeId;
  verseParagraphFlow: boolean;
  chapterSegmentMode: "default" | "t1";
};

export type ChapterSegmentMode = ReadBibleTypographyPrefsV1["chapterSegmentMode"];

/** 羊皮卷 / 读经 / 祷告正文：系统界面黑体栈（不再提供字体切换） */
export const READ_BIBLE_FONT_STACK_SYSTEM =
  'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Noto Sans CJK SC","Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif';

type SizeTokens = {
  verseRem: string;
  chapterTitleRem: string;
  homeTitleHe: string;
  homeTitleZh: string;
  homeTitleEn: string;
  contrastVerseRem: string;
};

const READ_BIBLE_SIZE_TOKENS: Record<ReadBibleSizeId, SizeTokens> = {
  s: {
    verseRem: "1.05rem",
    chapterTitleRem: "1.42rem",
    homeTitleHe: "clamp(2.35rem,9.5vmin,3.65rem)",
    homeTitleZh: "clamp(1.62rem,5.6vmin,2.65rem)",
    homeTitleEn: "clamp(0.75rem,2.05vmin,0.95rem)",
    contrastVerseRem: "0.92rem",
  },
  m: {
    verseRem: "1.1875rem",
    chapterTitleRem: "1.6rem",
    homeTitleHe: "clamp(2.75rem,11vmin,4.35rem)",
    homeTitleZh: "clamp(1.875rem,6.5vmin,3.125rem)",
    homeTitleEn: "clamp(0.8125rem,2.35vmin,1.0625rem)",
    contrastVerseRem: "1.02rem",
  },
  l: {
    verseRem: "1.32rem",
    chapterTitleRem: "1.78rem",
    homeTitleHe: "clamp(3.05rem,12vmin,4.85rem)",
    homeTitleZh: "clamp(2.05rem,7.2vmin,3.45rem)",
    homeTitleEn: "clamp(0.88rem,2.55vmin,1.12rem)",
    contrastVerseRem: "1.12rem",
  },
  xl: {
    verseRem: "1.48rem",
    chapterTitleRem: "1.95rem",
    homeTitleHe: "clamp(3.35rem,13vmin,5.35rem)",
    homeTitleZh: "clamp(2.25rem,8vmin,3.85rem)",
    homeTitleEn: "clamp(0.95rem,2.75vmin,1.2rem)",
    contrastVerseRem: "1.22rem",
  },
  xxl: {
    verseRem: "1.68rem",
    chapterTitleRem: "2.12rem",
    homeTitleHe: "clamp(3.65rem,14vmin,5.85rem)",
    homeTitleZh: "clamp(2.45rem,8.8vmin,4.15rem)",
    homeTitleEn: "clamp(1.02rem,2.95vmin,1.28rem)",
    contrastVerseRem: "1.34rem",
  },
  xxxl: {
    verseRem: "1.88rem",
    chapterTitleRem: "2.32rem",
    homeTitleHe: "clamp(4.05rem,15.5vmin,6.45rem)",
    homeTitleZh: "clamp(2.72rem,9.6vmin,4.6rem)",
    homeTitleEn: "clamp(1.1rem,3.2vmin,1.38rem)",
    contrastVerseRem: "1.48rem",
  },
  xxxxl: {
    verseRem: "2.1rem",
    chapterTitleRem: "2.54rem",
    homeTitleHe: "clamp(4.5rem,17vmin,7.15rem)",
    homeTitleZh: "clamp(3.02rem,10.5vmin,5.1rem)",
    homeTitleEn: "clamp(1.18rem,3.45vmin,1.48rem)",
    contrastVerseRem: "1.62rem",
  },
  xxxxxl: {
    verseRem: "2.34rem",
    chapterTitleRem: "2.78rem",
    homeTitleHe: "clamp(4.95rem,18.5vmin,7.85rem)",
    homeTitleZh: "clamp(3.35rem,11.5vmin,5.65rem)",
    homeTitleEn: "clamp(1.26rem,3.7vmin,1.58rem)",
    contrastVerseRem: "1.78rem",
  },
  xxxxxxl: {
    verseRem: "2.6rem",
    chapterTitleRem: "3.04rem",
    homeTitleHe: "clamp(5.45rem,20vmin,8.6rem)",
    homeTitleZh: "clamp(3.72rem,12.5vmin,6.25rem)",
    homeTitleEn: "clamp(1.34rem,3.95vmin,1.68rem)",
    contrastVerseRem: "1.94rem",
  },
  xxxxxxxl: {
    verseRem: "2.88rem",
    chapterTitleRem: "3.32rem",
    homeTitleHe: "clamp(5.95rem,21.5vmin,9.35rem)",
    homeTitleZh: "clamp(4.1rem,13.5vmin,6.85rem)",
    homeTitleEn: "clamp(1.42rem,4.2vmin,1.78rem)",
    contrastVerseRem: "2.12rem",
  },
};

export const DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS: ReadBibleTypographyPrefsV1 = {
  size: "l",
  verseParagraphFlow: true,
  chapterSegmentMode: "t1",
};

export function readBibleTypographyCssVars(prefs: ReadBibleTypographyPrefsV1): Record<string, string> {
  const sz = READ_BIBLE_SIZE_TOKENS[prefs.size];
  return {
    "--read-bible-font-family": READ_BIBLE_FONT_STACK_SYSTEM,
    "--read-bible-catalog-font-family": READ_BIBLE_FONT_STACK_SYSTEM,
    "--read-bible-verse-font-size": sz.verseRem,
    "--read-bible-contrast-verse-font-size": sz.contrastVerseRem,
    "--read-bible-chapter-title-font-size": sz.chapterTitleRem,
    "--read-bible-home-title-he": sz.homeTitleHe,
    "--read-bible-home-title-zh": sz.homeTitleZh,
    "--read-bible-home-title-en": sz.homeTitleEn,
  };
}

export const READ_BIBLE_SIZE_ORDER: ReadBibleSizeId[] = [
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
];

/** 一键大字预设：用于读经页设置里的「TT」快速按钮 */
export const READ_BIBLE_SIZE_PRESET_LARGE: ReadBibleSizeId = "xl";

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
  const fallback = { ...DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS };
  if (!raw || typeof raw !== "string") return fallback;
  try {
    const j = JSON.parse(raw) as Partial<ReadBibleTypographyPrefsV1> & { font?: string };
    const size = READ_BIBLE_SIZE_ORDER.includes(j.size as ReadBibleSizeId)
      ? (j.size as ReadBibleSizeId)
      : fallback.size;
    return {
      size,
      verseParagraphFlow:
        typeof j.verseParagraphFlow === "boolean" ? j.verseParagraphFlow : fallback.verseParagraphFlow,
      chapterSegmentMode: (() => {
        const rawMode = j.chapterSegmentMode as string | undefined;
        if (rawMode === "t1" || rawMode === "t2" || rawMode === "story") return "t1";
        if (rawMode === "default") return "default";
        return fallback.chapterSegmentMode;
      })(),
    };
  } catch {
    return fallback;
  }
}

export function readReadBibleTypographyPrefsFromStorage(): ReadBibleTypographyPrefsV1 {
  if (typeof window === "undefined") return { ...DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS };
  try {
    return parseReadBibleTypographyPrefs(window.localStorage.getItem(READ_BIBLE_TYPOGRAPHY_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS };
  }
}

export function writeReadBibleTypographyPrefsToStorage(prefs: ReadBibleTypographyPrefsV1): void {
  if (typeof window === "undefined") return;
  try {
    const normalized: ReadBibleTypographyPrefsV1 = {
      size: READ_BIBLE_SIZE_ORDER.includes(prefs.size)
        ? prefs.size
        : DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS.size,
      verseParagraphFlow: prefs.verseParagraphFlow === true,
      chapterSegmentMode: prefs.chapterSegmentMode === "t1" ? "t1" : "default",
    };
    window.localStorage.setItem(READ_BIBLE_TYPOGRAPHY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}
