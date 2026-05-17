/** 全站首页/壳层轮播经文池：主题库收录次数下限（与 `build:theme-repeat-pool --min=` 一致）。 */
export const DEFAULT_THEME_REPEAT_MIN_COUNT = 5;

/** Stable scope id for theme-repeat prayer pools (min occurrence count). */
export function themeRepeatPoolScopeId(minCount: number = DEFAULT_THEME_REPEAT_MIN_COUNT): string {
  const n = Math.max(1, Math.floor(minCount));
  return `theme-repeat-ge${n}`;
}
