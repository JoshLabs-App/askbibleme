import {
  buildWidgetRotationPoolKey,
  orderWidgetVersePoolEntries,
  pickDailyVerseKey,
} from "./pickDailyVerseKeyAtIndex";
import { fetchBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import { getLocale, hydrateLocaleFromStorage } from "../i18n/locale-store";
import { createT, toZhTwText } from "../i18n/site-copy";
import { flowLocaleForHomeVerseTranslationId } from "../home/homePrayerVersePrefs";
import { hydrateHomeVersePoolScope } from "../home/homeVersePoolScopePrefs";
import { readHomeVerseRotationSec } from "../home/homeVerseRotationPrefs";
import { joinVerseLinesForFlow } from "../home/joinVerseLinesForFlow";
import { loadHomeVerseManifest, resolveHomeVersePair } from "../home/verse-pool/loader";
import { readReadBibleTranslationPrefs } from "../read/read-bible-translation-prefs";
import { toLocalDateString } from "../read/reading-plan/reading-plan-prefs";
import { readReadingHabitStats, snapshotFromRecord } from "../read/reading-habit-stats";
import {
  type DailyVerseWidgetSnapshotV2,
  type WidgetVerseItemV1,
} from "./widget-snapshot-types";

function localizeVerseText(
  text: string,
  flowLocale: ReturnType<typeof flowLocaleForHomeVerseTranslationId>,
  uiLocale: ReturnType<typeof getLocale>,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return uiLocale === "zh-TW" && flowLocale !== "en" ? toZhTwText(trimmed) : trimmed;
}

function widgetPrimaryVerseLine(
  pair: NonNullable<Awaited<ReturnType<typeof resolveHomeVersePair>>>,
  primaryTranslationId: string,
  uiLocale: ReturnType<typeof getLocale>,
): string {
  const primaryFlow = flowLocaleForHomeVerseTranslationId(primaryTranslationId);
  return localizeVerseText(
    joinVerseLinesForFlow(pair.primary.lines, primaryFlow),
    primaryFlow,
    uiLocale,
  );
}

export async function buildDailyVerseWidgetSnapshot(
  date: string = toLocalDateString(new Date()),
): Promise<DailyVerseWidgetSnapshotV2 | null> {
  await hydrateLocaleFromStorage();
  const locale = getLocale();
  const t = createT(locale);
  const [manifest, scopeId, catalog, rotationIntervalSec] = await Promise.all([
    loadHomeVerseManifest(),
    hydrateHomeVersePoolScope(),
    fetchBibleTranslationsCatalog().catch(() => null),
    readHomeVerseRotationSec(),
  ]);
  if (!manifest?.entries.length) return null;

  const index = catalog ?? { translations: [], defaultTranslationId: null };
  const prefs = await readReadBibleTranslationPrefs(index, locale);
  const translationId = prefs.primaryTranslationId.trim() || "cuv-simp";
  const dailyVerseKey = pickDailyVerseKey({
    date,
    locale,
    translationId,
    scopeId,
    entries: manifest.entries,
  });
  const orderedEntries = orderWidgetVersePoolEntries(manifest.entries, dailyVerseKey);
  const verses: WidgetVerseItemV1[] = [];

  for (const entry of orderedEntries) {
    const pair = await resolveHomeVersePair(manifest, entry.verseKey, locale, translationId, "");
    const primaryLine = pair ? widgetPrimaryVerseLine(pair, translationId, locale) : "";
    if (!primaryLine) continue;

    const refFlow = flowLocaleForHomeVerseTranslationId(translationId);
    const ref = localizeVerseText(pair!.primary.ref, refFlow, locale);

    verses.push({
      verseKey: entry.verseKey,
      lines: [primaryLine],
      ref,
    });
  }

  if (!verses.length) return null;

  const rotationPoolKey = buildWidgetRotationPoolKey({
    scopeId,
    locale,
    translationId,
    verseKeys: verses.map((verse) => verse.verseKey),
  });

  const habitRecord = await readReadingHabitStats();
  const habitSnapshot = snapshotFromRecord(habitRecord, date);

  return {
    version: 2,
    date,
    locale,
    translationId,
    scopeId,
    rotationPoolKey,
    rotationIntervalSec,
    verses,
    readDays: habitSnapshot.readDays,
    streakDays: habitSnapshot.streakDays,
    readDaysLabel: t("pages.read.todayReadingStatReadLabel"),
    streakDaysLabel: t("pages.read.todayReadingStatStreakLabel"),
  };
}
