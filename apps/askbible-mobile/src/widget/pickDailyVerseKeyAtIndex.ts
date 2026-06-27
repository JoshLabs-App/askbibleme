type DailyVersePickEntry = {
  verseKey: string;
};

export function hashStringToUint32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

export function buildWidgetRotationPoolKey(args: {
  scopeId: string;
  locale: string;
  translationId: string;
  verseKeys: string[];
}): string {
  const { scopeId, locale, translationId, verseKeys } = args;
  const digest = hashStringToUint32(`${scopeId}|${locale}|${translationId}|${verseKeys.join("\n")}`);
  return `${scopeId}|${verseKeys.length}|${digest.toString(16)}`;
}

export function orderWidgetVersePoolEntries<T extends { verseKey: string }>(
  entries: T[],
  dailyVerseKey: string,
): T[] {
  if (entries.length <= 1) return entries;
  const startIdx = entries.findIndex((entry) => entry.verseKey === dailyVerseKey);
  if (startIdx <= 0) return entries;
  return [...entries.slice(startIdx), ...entries.slice(0, startIdx)];
}

/** Widget rotation pool — index 0 matches home daily verse. */
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
