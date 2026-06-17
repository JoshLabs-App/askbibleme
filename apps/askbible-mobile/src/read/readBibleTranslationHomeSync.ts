import { getLocale } from "../i18n/locale-store";
import {
  defaultHomePrimaryTranslationIdForLocale,
  readHomePrayerVersePrefs,
  writeHomePrayerVersePrefs,
} from "../home/homePrayerVersePrefs";
import type { BibleTranslationsIndex } from "../bible/translations-types";

export async function syncHomeVersePrefsFromPrimary(
  translationIndex: BibleTranslationsIndex,
  primaryId: string,
  opts?: { mode?: "auto" | "manual" },
): Promise<void> {
  const tr = translationIndex.translations.find((item) => item.id === primaryId);
  const isEnglish = /^en\b/i.test(tr?.language ?? "");
  const home = await readHomePrayerVersePrefs();
  const mode = opts?.mode ?? home.primaryTranslationMode;
  if (mode === "auto") {
    const locale = getLocale();
    await writeHomePrayerVersePrefs({
      ...home,
      primaryTranslationMode: "auto",
      verseTextZhTranslationId: defaultHomePrimaryTranslationIdForLocale(locale),
      verseTextEnTranslationId: "",
    });
    return;
  }
  if (isEnglish) {
    if (home.verseTextEnTranslationId === primaryId && home.primaryTranslationMode === "manual") return;
    await writeHomePrayerVersePrefs({
      ...home,
      primaryTranslationMode: "manual",
      verseTextEnTranslationId: primaryId,
    });
    return;
  }
  if (home.verseTextZhTranslationId === primaryId && home.primaryTranslationMode === "manual") return;
  await writeHomePrayerVersePrefs({
    ...home,
    primaryTranslationMode: "manual",
    verseTextZhTranslationId: primaryId,
  });
}
