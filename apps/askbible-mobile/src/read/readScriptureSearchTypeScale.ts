import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";

/** 圣经搜索页字号：经文跟读经页 verse；其余 chrome 随同一档位缩放并略大于旧固定字号。 */
export function scriptureSearchTypeForPx(px: ReadBibleTypographyPx) {
  const scale = Math.max(0.85, Math.min(2.8, px.verseFontSize / 16));
  const sx = (n: number) => Math.max(1, Math.round(n * scale * 10) / 10);
  return {
    titleSize: sx(24),
    leadSize: sx(16),
    leadLine: sx(24),
    scopeSize: sx(15),
    inputSize: px.verseFontSize,
    recentTitleSize: sx(14),
    recentChipSize: sx(15),
    hintSize: sx(14),
    emptySize: sx(16),
    emptyLine: sx(24),
    errorSize: sx(15),
    errorLine: sx(22),
    hitRefSize: px.verseNumFontSize,
    hitFontSize: px.verseFontSize,
    hitLineHeight: px.verseLineHeight,
    scopePadH: sx(12),
    scopePadV: sx(8),
    recentChipPadH: sx(12),
    recentChipPadV: sx(7),
    hitPadV: sx(12),
  };
}
