/** 主题库陈列次数 ≥ 此值才在读经页显示金句色带（可调）。 */
export const MIN_GOLDEN_THEME_REPEAT_COUNT = 3;

export function verseShowsGoldenThemeMarker(themeRepeatCount: number): boolean {
  const n = Number(themeRepeatCount);
  return Number.isInteger(n) && n >= MIN_GOLDEN_THEME_REPEAT_COUNT;
}
