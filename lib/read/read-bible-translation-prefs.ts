import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";

export const READ_BIBLE_TRANSLATION_STORAGE_KEY = "selah_read_bible_translation_v1";

export const READ_BIBLE_PRIMARY_TRANSLATION_COOKIE = "selah_read_primary_tid";

export const READ_BIBLE_CONTRAST_TRANSLATION_COOKIE = "selah_read_contrast_tid";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

export type ReadBibleTranslationPrefsV1 = {
  version: 1;
  primaryTranslationId: string;
  /** `null` = 无对照 */
  contrastTranslationId: string | null;
};

export const DEFAULT_READ_BIBLE_TRANSLATION_PREFS: ReadBibleTranslationPrefsV1 = {
  version: 1,
  primaryTranslationId: "cuv-simp",
  contrastTranslationId: null,
};

function allowedIds(index: BibleTranslationsIndex): Set<string> {
  return new Set(index.translations.map((t) => t.id));
}

export function normalizeReadBiblePrimaryTranslationId(
  raw: unknown,
  index: BibleTranslationsIndex,
): string {
  const fallback = index.defaultTranslationId ?? index.translations[0]?.id ?? "cuv-simp";
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
): ReadBibleTranslationPrefsV1 {
  const fallback = {
    ...DEFAULT_READ_BIBLE_TRANSLATION_PREFS,
    primaryTranslationId: normalizeReadBiblePrimaryTranslationId(null, index),
  };
  if (!raw?.trim()) return fallback;
  try {
    const j = JSON.parse(raw) as Partial<ReadBibleTranslationPrefsV1>;
    if (j?.version !== 1) return fallback;
    const primaryTranslationId = normalizeReadBiblePrimaryTranslationId(j.primaryTranslationId, index);
    const contrastTranslationId = normalizeReadBibleContrastTranslationId(
      j.contrastTranslationId,
      index,
      primaryTranslationId,
    );
    return { version: 1, primaryTranslationId, contrastTranslationId };
  } catch {
    return fallback;
  }
}

export function readReadBibleTranslationPrefsFromStorage(
  index: BibleTranslationsIndex,
): ReadBibleTranslationPrefsV1 {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_READ_BIBLE_TRANSLATION_PREFS,
      primaryTranslationId: normalizeReadBiblePrimaryTranslationId(null, index),
    };
  }
  try {
    return parseReadBibleTranslationPrefs(
      window.localStorage.getItem(READ_BIBLE_TRANSLATION_STORAGE_KEY),
      index,
    );
  } catch {
    return {
      ...DEFAULT_READ_BIBLE_TRANSLATION_PREFS,
      primaryTranslationId: normalizeReadBiblePrimaryTranslationId(null, index),
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
): ReadBibleTranslationPrefsV1 {
  const primaryRaw = cookieStore.get(READ_BIBLE_PRIMARY_TRANSLATION_COOKIE)?.value;
  const contrastRaw = cookieStore.get(READ_BIBLE_CONTRAST_TRANSLATION_COOKIE)?.value;
  const primaryTranslationId = normalizeReadBiblePrimaryTranslationId(primaryRaw ?? null, index);
  const contrastTranslationId = normalizeReadBibleContrastTranslationId(
    contrastRaw ?? null,
    index,
    primaryTranslationId,
  );
  return { version: 1, primaryTranslationId, contrastTranslationId };
}
