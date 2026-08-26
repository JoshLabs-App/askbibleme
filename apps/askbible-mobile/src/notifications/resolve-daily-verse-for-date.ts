import { pickDailyVerseKey } from "@/lib/daily-verse/pick-daily-verse-key";
import { fetchBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import type { AppLocale } from "../i18n/config";
import { getLocale } from "../i18n/locale-store";
import { hydrateHomeVersePoolScope } from "../home/homeVersePoolScopePrefs";
import { loadHomeVerseManifest, resolveHomeVerseEntry } from "../home/verse-pool/loader";
import type { HomeVerseEntry } from "../home/verse-pool/types";
import { readReadBibleTranslationPrefs } from "../read/read-bible-translation-prefs";
import { toLocalDateString } from "../read/reading-plan/reading-plan-prefs";

export type DailyVerseSnapshotV1 = {
  version: 1;
  date: string;
  locale: AppLocale;
  translationId: string;
  scopeId: string;
  verseKey: string;
  lines: string[];
  ref: string;
};

export async function resolveDailyVerseForDate(
  date: string = toLocalDateString(new Date()),
): Promise<DailyVerseSnapshotV1 | null> {
  const locale = getLocale();
  const [manifest, scopeId, catalog] = await Promise.all([
    loadHomeVerseManifest(),
    hydrateHomeVersePoolScope(),
    fetchBibleTranslationsCatalog().catch(() => null),
  ]);
  if (!manifest?.entries.length) return null;

  const index = catalog ?? { translations: [], defaultTranslationId: null };
  const prefs = await readReadBibleTranslationPrefs(index, locale);
  const translationId = prefs.primaryTranslationId.trim() || "cuv-simp";
  const verseKey = pickDailyVerseKey({
    date,
    locale,
    translationId,
    scopeId,
    entries: manifest.entries,
  });
  if (!verseKey) return null;

  const entry: HomeVerseEntry | null = await resolveHomeVerseEntry(
    manifest,
    verseKey,
    locale,
    translationId,
    "",
  );
  if (!entry?.lines.length) return null;

  return {
    version: 1,
    date,
    locale,
    translationId,
    scopeId,
    verseKey,
    lines: entry.lines,
    ref: entry.ref,
  };
}

export function formatDailyVerseNotificationBody(snapshot: DailyVerseSnapshotV1): string {
  const line = snapshot.lines[0]?.trim() ?? "";
  if (!line) return snapshot.ref;
  if (line.length <= 120) return `${line}\n${snapshot.ref}`;
  return `${line.slice(0, 117)}…\n${snapshot.ref}`;
}
