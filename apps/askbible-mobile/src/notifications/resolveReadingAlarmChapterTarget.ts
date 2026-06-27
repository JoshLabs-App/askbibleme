import { bundledBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { getLocale } from "../i18n/locale-store";
import { resolveChapterAudioTranslationId } from "../read/read-chapter-audio-translation";
import { readReadBibleTranslationPrefs } from "../read/read-bible-translation-prefs";
import { buildPlanChapterQueue } from "../read/read-plan-flow-nav";
import { readEffectiveReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "../read/reading-plan/today-reading-plan-payload";

export type ReadingAlarmChapterTarget = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  label: string;
};

export async function resolveReadingAlarmChapterTarget(): Promise<ReadingAlarmChapterTarget | null> {
  const locale = getLocale();
  const prefs = await readEffectiveReadingPlanPrefs();
  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return null;

  const first = buildPlanChapterQueue(readings)[0];
  if (!first) return null;

  const index = bundledBibleTranslationsCatalog();
  const translationPrefs = await readReadBibleTranslationPrefs(index, locale);
  const translationId = resolveChapterAudioTranslationId(translationPrefs, index);
  const bookName = getScriptureBookDisplayName(first.bookId, locale);

  return {
    bookId: first.bookId,
    chapter: first.chapter,
    bookName,
    translationId,
    label: `${bookName} ${first.chapter}`,
  };
}
