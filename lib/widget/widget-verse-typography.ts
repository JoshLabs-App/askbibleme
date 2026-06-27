import type { WidgetTextScalePref } from "./widget-text-scale";

export type WidgetVerseTypography = {
  verseFontSize: number;
  refFontSize: number;
  maxLines: number;
  minScaleFactor: number;
};

function autoVerseFontSize(charCount: number, isSmallWidget: boolean): number {
  if (isSmallWidget) {
    if (charCount <= 24) return 15;
    if (charCount <= 42) return 13;
    if (charCount <= 64) return 12;
    return 11;
  }
  if (charCount <= 36) return 17;
  if (charCount <= 58) return 15;
  if (charCount <= 88) return 13;
  return 12;
}

function applyTextScale(base: number, scale: WidgetTextScalePref, isSmallWidget: boolean): number {
  if (scale === "comfortable") return Math.min(isSmallWidget ? 16 : 18, base + 1);
  if (scale === "compact") return Math.max(10, base - 1);
  return base;
}

/**
 * Home-screen widget typography: length-aware auto sizing, with optional user scale.
 * `isSmallWidget` = iOS .systemSmall or Android width under ~180dp.
 */
export function resolveWidgetVerseTypography(args: {
  verseLine: string;
  isSmallWidget: boolean;
  textScale?: WidgetTextScalePref;
}): WidgetVerseTypography {
  const chars = args.verseLine.trim().length;
  const isSmall = args.isSmallWidget;
  const scale = args.textScale ?? "auto";
  const verseFontSize = applyTextScale(autoVerseFontSize(chars, isSmall), scale, isSmall);

  const maxLines = isSmall
    ? chars > 64
      ? 5
      : 4
    : chars > 88
      ? 7
      : 6;

  return {
    verseFontSize,
    refFontSize: isSmall ? 10 : 11,
    maxLines,
    minScaleFactor: chars > (isSmall ? 64 : 88) ? 0.78 : 0.88,
  };
}
