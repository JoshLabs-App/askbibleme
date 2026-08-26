import {
  bundledBibleTranslationsCatalog,
  fetchBibleTranslationsCatalog,
} from "../api/fetchBibleTranslationsCatalog";
import {
  resolveGoldenVerseAudioTranslationForLocale,
  writeHomeGoldenVerseAudioTranslationId,
} from "../home/homeGoldenVerseAudioPrefs";
import { readHomePrayerVersePrefs, writeHomePrayerVersePrefs } from "../home/homePrayerVersePrefs";
import {
  resolveDefaultPrimaryTranslationId,
  writeReadBibleTranslationPrefs,
  writeReadBibleTranslationPrefMode,
} from "../read/read-bible-translation-prefs";
import type { AppLocale } from "./config";

/** 切换界面语言时同步读经 / 自然页译本 prefs（抽屉与首次欢迎共用）。 */
export async function applyLocaleWithTranslationPrefs(nextLocale: AppLocale): Promise<void> {
  // 先标 auto，避免后续读 prefs 仍按 manual 留在旧译本（如 KJV）。
  await writeReadBibleTranslationPrefMode("auto");

  let index = bundledBibleTranslationsCatalog();
  try {
    index = await fetchBibleTranslationsCatalog();
  } catch {
    /* 离线目录已含 web-en / cuv */
  }
  const localePrimary = resolveDefaultPrimaryTranslationId(index, nextLocale);
  await writeReadBibleTranslationPrefs(
    {
      version: 1,
      primaryTranslationId: localePrimary,
      contrastTranslationIds: [],
      audioTranslationId: null,
    },
    index,
  );

  const homePrefs = await readHomePrayerVersePrefs();
  await writeHomePrayerVersePrefs({
    ...homePrefs,
    primaryTranslationMode: "auto",
    verseTextZhTranslationId: localePrimary,
    verseTextEnTranslationId: "",
  });

  // 金句朗读：英文 → WEB；中文 → CUV；其它无音轨 → 英文。
  await writeHomeGoldenVerseAudioTranslationId(
    resolveGoldenVerseAudioTranslationForLocale(nextLocale),
  );
}
