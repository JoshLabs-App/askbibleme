import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { pickTranslationIdForLocale } from "@/lib/bible/pick-translation-for-locale";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import { normalizeReadBibleAudioTranslationId } from "@/lib/read/read-chapter-audio-translation";

function translationLangFamily(language: string): "en" | "zh-hant" | "zh-hans" | "other" {
  const lang = language.trim().toLowerCase();
  if (lang.startsWith("en")) return "en";
  if (lang.includes("hant") || lang === "zh-tw") return "zh-hant";
  if (lang.startsWith("zh")) return "zh-hans";
  return "other";
}

export function uiLocaleScriptureLangFamily(locale: AppLocale): "en" | "zh-hant" | "zh-hans" {
  if (locale === "en") return "en";
  if (locale === "zh-TW") return "zh-hant";
  return "zh-hans";
}

/** 章页 SSR：界面语言与已存译本语言不一致时，跟界面语言走。 */
export function resolveReadChapterPrimaryTranslationId(
  prefs: ReadBibleTranslationPrefsV1,
  index: BibleTranslationsIndex,
  locale: AppLocale,
): string {
  const stored = prefs.primaryTranslationId;
  const meta = index.translations.find((t) => t.id === stored);
  const storedFamily = translationLangFamily(meta?.language ?? "");
  const localeFamily = uiLocaleScriptureLangFamily(locale);
  if (storedFamily === localeFamily) return stored;
  return resolveDefaultPrimaryTranslationId(index, locale);
}

export const READ_BIBLE_TRANSLATION_STORAGE_KEY = "selah_read_bible_translation_v1";

export const READ_BIBLE_PRIMARY_TRANSLATION_COOKIE = "selah_read_primary_tid";

export const READ_BIBLE_CONTRAST_TRANSLATION_COOKIE = "selah_read_contrast_tid";

export const READ_BIBLE_AUDIO_TRANSLATION_COOKIE = "selah_read_audio_tid";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

export type ReadBibleTranslationPrefsV1 = {
  version: 1;
  primaryTranslationId: string;
  contrastTranslationIds: string[];
  /** 兼容旧数据：单选时代字段 */
  contrastTranslationId?: string | null;
  /** `null` = 朗读与屏幕主译本相同 */
  audioTranslationId: string | null;
};

export const DEFAULT_READ_BIBLE_TRANSLATION_PREFS: ReadBibleTranslationPrefsV1 = {
  version: 1,
  primaryTranslationId: "cuv-simp",
  contrastTranslationIds: [],
  audioTranslationId: null,
};

function allowedIds(index: BibleTranslationsIndex): Set<string> {
  return new Set(index.translations.map((t) => t.id));
}

function firstAvailableTranslationId(index: BibleTranslationsIndex, ids: string[]): string | null {
  const allowed = allowedIds(index);
  for (const id of ids) {
    const tid = id.trim();
    if (tid && allowed.has(tid)) return tid;
  }
  return null;
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
  return (
    firstAvailableTranslationId(index, ["cuv-simp", "cuv-trad"]) ??
    index.defaultTranslationId ??
    index.translations[0]?.id ??
    "cuv-simp"
  );
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

/** 首项对照（兼容旧 UI / Cookie 单值读取） */
export function firstContrastTranslationId(prefs: ReadBibleTranslationPrefsV1): string | null {
  return prefs.contrastTranslationIds[0] ?? null;
}

function parseContrastIdsFromCookie(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const decoded = decodeURIComponent(raw.trim());
    if (decoded.includes(",")) {
      return decoded.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return decoded ? [decoded] : [];
  } catch {
    return raw.trim() ? [raw.trim()] : [];
  }
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
    const contrast = prefs.contrastTranslationIds.join(",");
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
  const primaryTranslationId = normalizeReadBiblePrimaryTranslationId(prefs.primaryTranslationId, index);
  const normalized: ReadBibleTranslationPrefsV1 = {
    version: 1,
    primaryTranslationId,
    contrastTranslationIds: normalizeReadBibleContrastTranslationIds(
      prefs.contrastTranslationIds ?? prefs.contrastTranslationId,
      index,
      primaryTranslationId,
    ),
    audioTranslationId: normalizeReadBibleAudioTranslationId(
      prefs.audioTranslationId,
      index,
      primaryTranslationId,
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
  const contrastTranslationIds = normalizeReadBibleContrastTranslationIds(
    parseContrastIdsFromCookie(contrastRaw),
    index,
    primaryTranslationId,
  );
  const audioRaw = cookieStore.get(READ_BIBLE_AUDIO_TRANSLATION_COOKIE)?.value;
  const audioTranslationId = normalizeReadBibleAudioTranslationId(
    audioRaw ?? null,
    index,
    primaryTranslationId,
  );
  return { version: 1, primaryTranslationId, contrastTranslationIds, audioTranslationId };
}

export type ReadBibleTranslationSyncBundle = {
  version: 1;
  prefs: ReadBibleTranslationPrefsV1 | null;
  mode: "auto" | "manual";
};

export function readReadBibleTranslationSyncBundle(
  index: BibleTranslationsIndex,
  locale?: AppLocale,
): ReadBibleTranslationSyncBundle {
  if (typeof window === "undefined") {
    return { version: 1, prefs: null, mode: "auto" };
  }
  const raw = window.localStorage.getItem(READ_BIBLE_TRANSLATION_STORAGE_KEY);
  if (!raw?.trim()) return { version: 1, prefs: null, mode: "auto" };
  return {
    version: 1,
    prefs: parseReadBibleTranslationPrefs(raw, index, locale),
    mode: "auto",
  };
}

export function applyReadBibleTranslationSyncBundle(
  bundle: ReadBibleTranslationSyncBundle,
  index: BibleTranslationsIndex,
): void {
  if (bundle.version !== 1 || !bundle.prefs) return;
  writeReadBibleTranslationPrefsToStorage(bundle.prefs, index);
}
