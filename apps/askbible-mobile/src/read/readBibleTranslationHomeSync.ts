import { getLocale } from "../i18n/locale-store";
import { bundledBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
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
  // translationIndex 可能来自陈旧的远端目录缓存（language 字段被冲成空串/缺失）；
  // 兜底查内置目录（随包发布，不受缓存污染），避免主译本明明是英文却被判成中文。
  const language =
    tr?.language || bundledBibleTranslationsCatalog().translations.find((item) => item.id === primaryId)?.language || "";
  const isEnglish = /^en\b/i.test(language);
  const home = await readHomePrayerVersePrefs();
  const mode = opts?.mode ?? home.primaryTranslationMode;
  if (mode === "auto") {
    const locale = getLocale();
    const autoZh = defaultHomePrimaryTranslationIdForLocale(locale);
    if (
      home.primaryTranslationMode !== "auto" ||
      home.verseTextZhTranslationId !== autoZh ||
      home.verseTextEnTranslationId !== ""
    ) {
      await writeHomePrayerVersePrefs({
        ...home,
        primaryTranslationMode: "auto",
        verseTextZhTranslationId: autoZh,
        verseTextEnTranslationId: "",
      });
    }
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
