import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { pickTranslationIdForLocale } from "@/lib/bible/pick-translation-for-locale";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import { normalizeReadBibleAudioTranslationId } from "@/lib/read/read-chapter-audio-translation";

export const READ_BIBLE_TRANSLATION_STORAGE_KEY = "selah_read_bible_translation_v1";

export const READ_BIBLE_PRIMARY_TRANSLATION_COOKIE = "selah_read_primary_tid";

export const READ_BIBLE_CONTRAST_TRANSLATION_COOKIE = "selah_read_contrast_tid";

export const READ_BIBLE_AUDIO_TRANSLATION_COOKIE = "selah_read_audio_tid";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

export type ReadBibleTranslationPrefsV1 = {
  version: 1;
  primaryTranslationId: string;
  /** `null` = 无对照 */
  contrastTranslationId: string | null;
  /** `null` = 朗读与屏幕主译本相同 */
  audioTranslationId: string | null;
};

export const DEFAULT_READ_BIBLE_TRANSLATION_PREFS: ReadBibleTranslationPrefsV1 = {
  version: 1,
  primaryTranslationId: "cuv-simp",
  contrastTranslationId: null,
  audioTranslationId: null,
};

function allowedIds(index: BibleTranslationsIndex): Set<string> {
  return new Set(index.translations.map((t) => t.id));
}

/** 无已存偏好时：界面 `zh-CN` → 和合本；`en` → WEB 等英文译本 */
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

export function normalizeReadBibleContrastTranslationId(
  raw: unknown,
  index: BibleTranslationsIndex,
  primaryId: string,
): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s === primaryId) return null;
  return allowedIds(index).has(s) ? s : null;
}

export function parseReadBibleTranslationPrefs(
  raw: string | null,
  index: BibleTranslationsIndex,
  locale?: AppLocale,
): ReadBibleTranslationPrefsV1 {
  const fallback = {
    ...DEFAULT_READ_BIBLE_TRANSLATION_PREFS,
    primaryTranslationId: resolveDefaultPrimaryTranslationId(index, locale),
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
    const contrastTranslationId = normalizeReadBibleContrastTranslationId(
      j.contrastTranslationId,
      index,
      primaryTranslationId,
    );
    const audioTranslationId = normalizeReadBibleAudioTranslationId(
      j.audioTranslationId,
      index,
      primaryTranslationId,
    );
    return { version: 1, primaryTranslationId, contrastTranslationId, audioTranslationId };
  } catch {
    return fallback;
  }
}

export function readReadBibleTranslationPrefsFromStorage(
  index: BibleTranslationsIndex,
  locale?: AppLocale,
): ReadBibleTranslationPrefsV1 {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_READ_BIBLE_TRANSLATION_PREFS,
      primaryTranslationId: resolveDefaultPrimaryTranslationId(index, locale),
    };
  }
  try {
    return parseReadBibleTranslationPrefs(
      window.localStorage.getItem(READ_BIBLE_TRANSLATION_STORAGE_KEY),
      index,
      locale,
    );
  } catch {
    return {
      ...DEFAULT_READ_BIBLE_TRANSLATION_PREFS,
      primaryTranslationId: resolveDefaultPrimaryTranslationId(index, locale),
    };
  }
}

export function persistReadBibleTranslationCookies(prefs: ReadBibleTranslationPrefsV1): void {
  if (typeof document === "undefined") return;
  try {
    const base = `path=/;max-age=${COOKIE_MAX_AGE_SEC};SameSite=Lax`;
    document.cookie = `${READ_BIBLE_PRIMARY_TRANSLATION_COOKIE}=${encodeURIComponent(prefs.primaryTranslationId)};${base}`;
    const contrast = prefs.contrastTranslationId ?? "";
    document.cookie = `${READ_BIBLE_CONTRAST_TRANSLATION_COOKIE}=${encodeURIComponent(contrast)};${base}`;
    const audio = prefs.audioTranslationId ?? "";
    document.cookie = `${READ_BIBLE_AUDIO_TRANSLATION_COOKIE}=${encodeURIComponent(audio)};${base}`;
  } catch {
    /* ignore */
  }
}

export function writeReadBibleTranslationPrefsToStorage(
  prefs: ReadBibleTranslationPrefsV1,
  index: BibleTranslationsIndex,
): ReadBibleTranslationPrefsV1 {
  const normalized: ReadBibleTranslationPrefsV1 = {
    version: 1,
    primaryTranslationId: normalizeReadBiblePrimaryTranslationId(prefs.primaryTranslationId, index),
    contrastTranslationId: normalizeReadBibleContrastTranslationId(
      prefs.contrastTranslationId,
      index,
      normalizeReadBiblePrimaryTranslationId(prefs.primaryTranslationId, index),
    ),
    audioTranslationId: normalizeReadBibleAudioTranslationId(
      prefs.audioTranslationId,
      index,
      normalizeReadBiblePrimaryTranslationId(prefs.primaryTranslationId, index),
    ),
  };
  if (typeof window === "undefined") return normalized;
  try {
    window.localStorage.setItem(READ_BIBLE_TRANSLATION_STORAGE_KEY, JSON.stringify(normalized));
    persistReadBibleTranslationCookies(normalized);
  } catch {
    /* ignore */
  }
  return normalized;
}

export function resolveReadBibleTranslationPrefsFromCookies(
  cookieStore: ReadonlyRequestCookies,
  index: BibleTranslationsIndex,
  localeHint?: AppLocale,
): ReadBibleTranslationPrefsV1 {
  const localeRaw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = localeRaw ? parseLocale(localeRaw) : localeHint;
  const primaryRaw = cookieStore.get(READ_BIBLE_PRIMARY_TRANSLATION_COOKIE)?.value;
  const contrastRaw = cookieStore.get(READ_BIBLE_CONTRAST_TRANSLATION_COOKIE)?.value;
  const primaryTranslationId = normalizeReadBiblePrimaryTranslationId(primaryRaw ?? null, index, locale);
  const contrastTranslationId = normalizeReadBibleContrastTranslationId(
    contrastRaw ?? null,
    index,
    primaryTranslationId,
  );
  const audioRaw = cookieStore.get(READ_BIBLE_AUDIO_TRANSLATION_COOKIE)?.value;
  const audioTranslationId = normalizeReadBibleAudioTranslationId(
    audioRaw ?? null,
    index,
    primaryTranslationId,
  );
  return { version: 1, primaryTranslationId, contrastTranslationId, audioTranslationId };
}
