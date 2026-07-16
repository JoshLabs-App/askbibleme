import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";

type TranslationAudioMeta = {
  id: string;
  language?: string;
};

type AudioBadgeLocale = "zh-CN" | "zh-TW" | "en" | "es" | "he";

export type TranslationAudioBadgeKind = "chapter" | "goldenVerse";
const GOLDEN_VERSE_AUDIO_TRANSLATION_IDS = new Set(["cuv-simp", "cuv-trad", "web-en"]);

export function translationSupportsGoldenVerseAudio(meta: TranslationAudioMeta): boolean {
  const id = String(meta.id || "").trim().toLowerCase();
  if (GOLDEN_VERSE_AUDIO_TRANSLATION_IDS.has(id)) return true;
  return false;
}

export function resolveTranslationAudioBadges(
  meta: TranslationAudioMeta,
): TranslationAudioBadgeKind[] {
  const badges: TranslationAudioBadgeKind[] = [];
  if (translationSupportsChapterAudio(meta.id)) badges.push("chapter");
  if (translationSupportsGoldenVerseAudio(meta)) badges.push("goldenVerse");
  return badges;
}

export function translationAudioBadgeLabel(
  kind: TranslationAudioBadgeKind,
  locale: AudioBadgeLocale,
): string {
  if (locale === "en") {
    return kind === "chapter" ? "Chapter audio" : "Verse audio";
  }
  return kind === "chapter" ? "整章音频" : "金句音频";
}
