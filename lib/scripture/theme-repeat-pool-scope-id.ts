/** Stable scope id for theme-repeat prayer pools (min occurrence count). */
export function themeRepeatPoolScopeId(minCount: number): string {
  const n = Math.max(1, Math.floor(minCount));
  return `theme-repeat-ge${n}`;
}
