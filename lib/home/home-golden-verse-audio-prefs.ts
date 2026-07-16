import type { GoldenVerseAudioTranslationId } from "@/lib/bible/golden-verse-audio";

const STORAGE_KEY = "selah-home-golden-verse-audio-translation-v1";
export const HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT =
  "selah:home-golden-verse-audio-translation-updated";

export const DEFAULT_GOLDEN_VERSE_AUDIO_TRANSLATION_ID: GoldenVerseAudioTranslationId = "cuv-simp";

export function normalizeGoldenVerseAudioTranslationId(
  value: unknown,
): GoldenVerseAudioTranslationId {
  return value === "web-en" ? "web-en" : DEFAULT_GOLDEN_VERSE_AUDIO_TRANSLATION_ID;
}

export function readHomeGoldenVerseAudioTranslationId(): GoldenVerseAudioTranslationId {
  if (typeof window === "undefined") return DEFAULT_GOLDEN_VERSE_AUDIO_TRANSLATION_ID;
  try {
    return normalizeGoldenVerseAudioTranslationId(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_GOLDEN_VERSE_AUDIO_TRANSLATION_ID;
  }
}

export function writeHomeGoldenVerseAudioTranslationId(
  translationId: GoldenVerseAudioTranslationId,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalizeGoldenVerseAudioTranslationId(translationId));
    window.dispatchEvent(new Event(HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT));
  } catch {
    /* ignore unavailable storage */
  }
}
