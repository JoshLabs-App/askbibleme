import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GoldenVerseAudioTranslationId } from "@/lib/bible/golden-verse-audio";
import type { AppLocale } from "../i18n/config";
import { NATURE_HOME_PREFS_KEYS } from "./natureHomePrefsKeys";

export const DEFAULT_HOME_GOLDEN_VERSE_AUDIO_TRANSLATION_ID: GoldenVerseAudioTranslationId =
  "cuv-simp";

let current: GoldenVerseAudioTranslationId =
  DEFAULT_HOME_GOLDEN_VERSE_AUDIO_TRANSLATION_ID;
let hydrated = false;
const listeners = new Set<() => void>();

export function normalizeHomeGoldenVerseAudioTranslationId(
  raw: unknown,
): GoldenVerseAudioTranslationId {
  return raw === "web-en" ? "web-en" : DEFAULT_HOME_GOLDEN_VERSE_AUDIO_TRANSLATION_ID;
}

/**
 * 界面语言 → 金句朗读音轨。
 * 仅中文有独立包；英文及其它无对应音轨的语言一律回落英文 WEB。
 */
export function resolveGoldenVerseAudioTranslationForLocale(
  locale: AppLocale,
): GoldenVerseAudioTranslationId {
  if (locale === "zh-CN" || locale === "zh-TW") return "cuv-simp";
  return "web-en";
}

export function getHomeGoldenVerseAudioTranslationId(): GoldenVerseAudioTranslationId {
  return current;
}

export function subscribeHomeGoldenVerseAudioTranslationId(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export async function hydrateHomeGoldenVerseAudioTranslationId(): Promise<GoldenVerseAudioTranslationId> {
  if (hydrated) return current;
  try {
    current = normalizeHomeGoldenVerseAudioTranslationId(
      await AsyncStorage.getItem(NATURE_HOME_PREFS_KEYS.goldenVerseAudioTranslation),
    );
  } catch {
    current = DEFAULT_HOME_GOLDEN_VERSE_AUDIO_TRANSLATION_ID;
  }
  hydrated = true;
  emit();
  return current;
}

export async function writeHomeGoldenVerseAudioTranslationId(
  next: GoldenVerseAudioTranslationId,
): Promise<void> {
  current = normalizeHomeGoldenVerseAudioTranslationId(next);
  hydrated = true;
  try {
    await AsyncStorage.setItem(
      NATURE_HOME_PREFS_KEYS.goldenVerseAudioTranslation,
      current,
    );
  } catch {
    /* keep the in-memory selection */
  }
  emit();
}
