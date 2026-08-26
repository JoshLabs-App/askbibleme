import { getLocale } from "../i18n/locale-store";
import {
  resolveGoldenVerseAudioTranslationForLocale,
  writeHomeGoldenVerseAudioTranslationId,
} from "../home/homeGoldenVerseAudioPrefs";
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
    await writeHomeGoldenVerseAudioTranslationId(
      resolveGoldenVerseAudioTranslationForLocale(locale),
    );
    return;
  }
  // 金句朗读跟主译本语言（仅有 cuv-simp / web-en 音轨）。
  await writeHomeGoldenVerseAudioTranslationId(isEnglish ? "web-en" : "cuv-simp");
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
