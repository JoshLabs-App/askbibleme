import AsyncStorage from "@react-native-async-storage/async-storage";
import { pickTranslationIdForLocale } from "../bible/pick-translation-for-locale";
import type { AppLocale } from "../i18n/config";
import type { BibleTranslationsIndex } from "../bible/translations-types";
import { normalizeReadBibleAudioTranslationId } from "./read-chapter-audio-translation";

export const READ_BIBLE_TRANSLATION_STORAGE_KEY = "selah_read_bible_translation_v1";
export const READ_BIBLE_TRANSLATION_MODE_STORAGE_KEY = "selah_read_bible_translation_mode_v1";

export type ReadBibleTranslationPrefsV1 = {
  version: 1;
  primaryTranslationId: string;
  contrastTranslationIds: string[];
  /** 兼容旧数据：单选时代字段 */
  contrastTranslationId?: string | null;
  /** `null` = 朗读与屏幕主译本相同 */
  audioTranslationId: string | null;
};

export type ReadBibleTranslationPrefMode = "auto" | "manual";

export const DEFAULT_READ_BIBLE_TRANSLATION_PREFS: ReadBibleTranslationPrefsV1 = {
  version: 1,
  primaryTranslationId: "cuv-simp",
  contrastTranslationIds: [],
  audioTranslationId: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeReadBibleTranslation(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

function allowedIds(index: BibleTranslationsIndex): Set<string> {
  return new Set(index.translations.map((t) => t.id));
}

export function resolveDefaultPrimaryTranslationId(
  index: BibleTranslationsIndex,
  locale?: AppLocale,
): string {
  if (locale) {
    const picked = pickTranslationIdForLocale(index, locale);
    if (picked && allowedIds(index).has(picked)) return picked;
  }
  return index.defaultTranslationId ?? index.translations[0]?.id ?? "cuv-simp";
}

export function normalizeReadBiblePrimaryTranslationId(
  raw: unknown,
  index: BibleTranslationsIndex,
  locale?: AppLocale,
): string {
  const fallback = resolveDefaultPrimaryTranslationId(index, locale);
  const s = typeof raw === "string" ? raw.trim() : "";
  return s && allowedIds(index).has(s) ? s : fallback;
}

export function normalizeReadBibleContrastTranslationIds(
  raw: unknown,
  index: BibleTranslationsIndex,
  primaryId: string,
): string[] {
  const allowed = allowedIds(index);
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    const picked: string[] = [];
    for (const item of raw) {
      const s = typeof item === "string" ? item.trim() : "";
      if (!s || s === primaryId || seen.has(s) || !allowed.has(s)) continue;
      seen.add(s);
      picked.push(s);
    }
    return picked;
  }
  const single = typeof raw === "string" ? raw.trim() : "";
  if (!single || single === primaryId || !allowed.has(single)) return [];
  return [single];
}

export function parseReadBibleTranslationPrefs(
  raw: string | null,
  index: BibleTranslationsIndex,
  locale?: AppLocale,
): ReadBibleTranslationPrefsV1 {
  const fallback: ReadBibleTranslationPrefsV1 = {
    version: 1,
    primaryTranslationId: resolveDefaultPrimaryTranslationId(index, locale),
    contrastTranslationIds: [],
    audioTranslationId: null,
  };
  if (!raw?.trim()) return fallback;
  try {
    const j = JSON.parse(raw) as Partial<ReadBibleTranslationPrefsV1>;
    if (j?.version !== 1) return fallback;
    const primaryTranslationId = normalizeReadBiblePrimaryTranslationId(
      j.primaryTranslationId,
      index,
      locale,
    );
    const contrastTranslationIds = normalizeReadBibleContrastTranslationIds(
      j.contrastTranslationIds ?? j.contrastTranslationId,
      index,
      primaryTranslationId,
    );
    const audioTranslationId = normalizeReadBibleAudioTranslationId(
      j.audioTranslationId,
      index,
      primaryTranslationId,
    );
    return { version: 1, primaryTranslationId, contrastTranslationIds, audioTranslationId };
  } catch {
    return fallback;
  }
}

export async function readReadBibleTranslationPrefs(
  index: BibleTranslationsIndex,
  locale?: AppLocale,
): Promise<ReadBibleTranslationPrefsV1> {
  try {
    const raw = await AsyncStorage.getItem(READ_BIBLE_TRANSLATION_STORAGE_KEY);
    return parseReadBibleTranslationPrefs(raw, index, locale);
  } catch {
    return parseReadBibleTranslationPrefs(null, index, locale);
  }
}

export async function hasReadBibleTranslationPrefsStored(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(READ_BIBLE_TRANSLATION_STORAGE_KEY);
    return Boolean(raw?.trim());
  } catch {
    return false;
  }
}

export async function writeReadBibleTranslationPrefs(
  prefs: ReadBibleTranslationPrefsV1,
  index: BibleTranslationsIndex,
): Promise<ReadBibleTranslationPrefsV1> {
  const normalized: ReadBibleTranslationPrefsV1 = {
    version: 1,
    primaryTranslationId: normalizeReadBiblePrimaryTranslationId(prefs.primaryTranslationId, index),
    contrastTranslationIds: normalizeReadBibleContrastTranslationIds(
      prefs.contrastTranslationIds ?? prefs.contrastTranslationId,
      index,
      normalizeReadBiblePrimaryTranslationId(prefs.primaryTranslationId, index),
    ),
    audioTranslationId: normalizeReadBibleAudioTranslationId(
      prefs.audioTranslationId,
      index,
      normalizeReadBiblePrimaryTranslationId(prefs.primaryTranslationId, index),
    ),
  };
  try {
    await AsyncStorage.setItem(READ_BIBLE_TRANSLATION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  emit();
  return normalized;
}

export async function readReadBibleTranslationPrefMode(): Promise<ReadBibleTranslationPrefMode> {
  try {
    const raw = (await AsyncStorage.getItem(READ_BIBLE_TRANSLATION_MODE_STORAGE_KEY))?.trim();
    return raw === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

export async function writeReadBibleTranslationPrefMode(
  mode: ReadBibleTranslationPrefMode,
): Promise<void> {
  try {
    await AsyncStorage.setItem(READ_BIBLE_TRANSLATION_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}
