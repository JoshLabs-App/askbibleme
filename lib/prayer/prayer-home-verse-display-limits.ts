import type { VerseRef } from "@/lib/bible/verse-ref";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

/** 连续经节超过该节数不进首页祷告池（避免窄屏轮播被撑爆）。 */
export const PRAYER_HOME_MAX_VERSE_SPAN = 2;

/** resolve 后单语展示行数上限（与 `splitVerseTextToDisplayLines` 分行策略配合）。 */
export const PRAYER_HOME_MAX_LINES_PER_LOCALE = 5;

/** resolve 后单语总字数上限（中英分别计）。 */
export const PRAYER_HOME_MAX_CHARS_PER_LOCALE = 400;

export function isShortVerseRefForPrayerHomePool(ref: VerseRef): boolean {
  const span = ref.verseEnd - ref.verseStart + 1;
  return Number.isInteger(span) && span >= 1 && span <= PRAYER_HOME_MAX_VERSE_SPAN;
}

export function homeVerseEntryFitsPrayerHomeDisplay(entry: HomeVerseEntry | null | undefined): boolean {
  if (!entry) return false;
  const lines = entry.lines ?? [];
  if (lines.length === 0 || lines.length > PRAYER_HOME_MAX_LINES_PER_LOCALE) return false;
  const chars = lines.join("").length;
  return chars > 0 && chars <= PRAYER_HOME_MAX_CHARS_PER_LOCALE;
}
