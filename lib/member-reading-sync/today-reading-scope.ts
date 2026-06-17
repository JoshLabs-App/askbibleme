export function planIdFromTodayReadingScopeKey(scopeKey: string | null | undefined): string | null {
  if (!scopeKey?.trim()) return null;
  return scopeKey.split(":")[0]?.trim() || null;
}

export function isSameTodayReadingPlanScope(
  scopeA: string | null | undefined,
  scopeB: string | null | undefined,
): boolean {
  if (!scopeA || !scopeB) return false;
  if (scopeA === scopeB) return true;
  const planA = planIdFromTodayReadingScopeKey(scopeA);
  const planB = planIdFromTodayReadingScopeKey(scopeB);
  return Boolean(planA && planB && planA === planB);
}

export function readTodayReadingDoneKeysFromValue(v: unknown): string[] {
  if (!v || typeof v !== "object") return [];
  const arr = (v as { doneKeys?: unknown }).doneKeys;
  return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}
