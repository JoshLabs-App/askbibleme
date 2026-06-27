export type DailyVersePickEntry = {
  verseKey: string;
};

/** FNV-1a 32-bit — stable across JS runtimes for the same input string. */
export function hashStringToUint32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic daily verse: same date + locale + translation + scope → same verseKey.
 * Does not use randomness or spaced-repetition memory (unlike home rotator).
 */
export function pickDailyVerseKey(args: {
  date: string;
  locale: string;
  translationId: string;
  scopeId: string;
  entries: DailyVersePickEntry[];
}): string {
  const { date, locale, translationId, scopeId, entries } = args;
  if (!entries.length) return "";
  const seed = `${date}|${locale}|${translationId}|${scopeId}`;
  const idx = hashStringToUint32(seed) % entries.length;
  return entries[idx]!.verseKey;
}

/** Deterministic verse pool slot for widget rotation (index 0 matches {@link pickDailyVerseKey}). */
export function pickDailyVerseKeyAtIndex(args: {
  date: string;
  locale: string;
  translationId: string;
  scopeId: string;
  entries: DailyVersePickEntry[];
  index: number;
}): string {
  const { date, locale, translationId, scopeId, entries, index } = args;
  if (!entries.length) return "";
  if (index === 0) {
    return pickDailyVerseKey({ date, locale, translationId, scopeId, entries });
  }
  const seed = `${date}|${locale}|${translationId}|${scopeId}|${index}`;
  const idx = hashStringToUint32(seed) % entries.length;
  return entries[idx]!.verseKey;
}
