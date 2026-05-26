/**
 * 与 `lib/bible/golden-verse-theme-repeat.ts` 保持同步（阈值与展示判断）。
 */

export const MIN_GOLDEN_THEME_REPEAT_COUNT = 3;

export function verseShowsGoldenThemeMarker(themeRepeatCount: number): boolean {
  const n = Number(themeRepeatCount);
  return Number.isInteger(n) && n >= MIN_GOLDEN_THEME_REPEAT_COUNT;
}
