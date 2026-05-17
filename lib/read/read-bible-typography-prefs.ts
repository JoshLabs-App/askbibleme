export const READ_BIBLE_TYPOGRAPHY_STORAGE_KEY = "selah_read_bible_typography_v1";

export type ReadBibleSizeId = "s" | "m" | "l" | "xl" | "xxl";

export type ReadBibleTypographyPrefsV1 = {
  size: ReadBibleSizeId;
};

/** 羊皮卷 / 读经 / 祷告正文：系统界面黑体栈（不再提供字体切换） */
export const READ_BIBLE_FONT_STACK_SYSTEM =
  'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","PingFang SC","Microsoft YaHei",sans-serif';

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
};

export const DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS: ReadBibleTypographyPrefsV1 = {
  size: "m",
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

export const READ_BIBLE_SIZE_ORDER: ReadBibleSizeId[] = ["s", "m", "l", "xl", "xxl"];

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
  if (!raw || typeof raw !== "string") return { ...DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS };
  try {
    const j = JSON.parse(raw) as Partial<ReadBibleTypographyPrefsV1> & { font?: string };
    const size = READ_BIBLE_SIZE_ORDER.includes(j.size as ReadBibleSizeId)
      ? (j.size as ReadBibleSizeId)
      : "m";
    return { size };
  } catch {
    return { ...DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS };
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
    const size = READ_BIBLE_SIZE_ORDER.includes(prefs.size) ? prefs.size : "m";
    window.localStorage.setItem(READ_BIBLE_TYPOGRAPHY_STORAGE_KEY, JSON.stringify({ size }));
  } catch {
    /* ignore */
  }
}
