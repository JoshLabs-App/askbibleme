import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GoldenVerseAudioTranslationId } from "@/lib/bible/golden-verse-audio";
import { GOLDEN_VERSE_AUDIO_READY_MIN_FILES } from "./goldenVersePackPolicy";
import {
  goldenVerseLangPackDir,
  goldenVerseLangPackId,
  type GoldenVerseLangPackId,
} from "./goldenVersePackPaths";

const READY_KEY_PREFIX = "askbible-golden-verse-audio-ready-v1:";

const readyByLang: Record<string, boolean> = {};
const hydratedByLang = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function langKey(translationId: GoldenVerseAudioTranslationId): GoldenVerseLangPackId {
  return goldenVerseLangPackId(translationId);
}

function storageKey(lang: GoldenVerseLangPackId): string {
  return `${READY_KEY_PREFIX}${lang}`;
}

export function subscribeGoldenVerseAudioReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @deprecated 兼容旧名 */
export const subscribeGoldenVerseGe5PackReady = subscribeGoldenVerseAudioReady;

export function isGoldenVerseAudioReady(
  translationId: GoldenVerseAudioTranslationId = "cuv-simp",
): boolean {
  return Boolean(readyByLang[langKey(translationId)]);
}

/** @deprecated 兼容旧名 */
export const isGoldenVerseGe5PackReady = isGoldenVerseAudioReady;

function countMp3InAudioDir(translationId: GoldenVerseAudioTranslationId): number {
  try {
    const dir = goldenVerseLangPackDir(goldenVerseLangPackId(translationId));
    if (!dir.exists) return 0;
    let n = 0;
    for (const entry of dir.list()) {
      if (entry.name.endsWith(".mp3")) n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

export function countGoldenVerseAudioMp3Files(
  translationId: GoldenVerseAudioTranslationId,
): number {
  return countMp3InAudioDir(translationId);
}

export async function reconcileGoldenVerseAudioReadyFromDisk(
  translationId: GoldenVerseAudioTranslationId,
): Promise<boolean> {
  await hydrateGoldenVerseAudioReady(translationId);
  if (isGoldenVerseAudioReady(translationId)) return true;
  const count = countMp3InAudioDir(translationId);
  if (count >= GOLDEN_VERSE_AUDIO_READY_MIN_FILES) {
    await markGoldenVerseAudioReady(translationId);
    return true;
  }
  return false;
}

/** @deprecated 兼容旧名 */
export const reconcileGoldenVerseGe5ReadyFromDisk = reconcileGoldenVerseAudioReadyFromDisk;
export const countGoldenVerseGe5Mp3Files = countGoldenVerseAudioMp3Files;

export async function hydrateGoldenVerseAudioReady(
  translationId: GoldenVerseAudioTranslationId = "cuv-simp",
): Promise<boolean> {
  const lang = langKey(translationId);
  if (hydratedByLang.has(lang)) return Boolean(readyByLang[lang]);
  try {
    readyByLang[lang] = (await AsyncStorage.getItem(storageKey(lang))) === "1";
  } catch {
    readyByLang[lang] = false;
  }
  hydratedByLang.add(lang);
  emit();
  return Boolean(readyByLang[lang]);
}

/** @deprecated 兼容旧名 */
export const hydrateGoldenVerseGe5PackReady = hydrateGoldenVerseAudioReady;

export async function markGoldenVerseAudioReady(
  translationId: GoldenVerseAudioTranslationId,
): Promise<void> {
  const lang = langKey(translationId);
  if (readyByLang[lang] === true && hydratedByLang.has(lang)) return;
  readyByLang[lang] = true;
  hydratedByLang.add(lang);
  emit();
  try {
    await AsyncStorage.setItem(storageKey(lang), "1");
  } catch {
    /* keep memory */
  }
}

/** @deprecated 兼容旧名 */
export const markGoldenVerseGe5PackReady = markGoldenVerseAudioReady;

export async function clearGoldenVerseAudioReadyForTests(
  translationId?: GoldenVerseAudioTranslationId,
): Promise<void> {
  if (translationId) {
    const lang = langKey(translationId);
    readyByLang[lang] = false;
    hydratedByLang.add(lang);
    emit();
    try {
      await AsyncStorage.removeItem(storageKey(lang));
    } catch {
      /* ignore */
    }
    return;
  }
  for (const lang of Object.keys(readyByLang)) {
    readyByLang[lang] = false;
    try {
      await AsyncStorage.removeItem(storageKey(lang as GoldenVerseLangPackId));
    } catch {
      /* ignore */
    }
  }
  emit();
}
