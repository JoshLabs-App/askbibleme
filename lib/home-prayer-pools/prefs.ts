import type {
  HomePrayerVersePrefsV1,
  VerseDisplayModeV1,
  VerseScopeV1,
} from "@/lib/home-prayer-pools/types";
import { HOME_PRAYER_PREFS_STORAGE_KEY, VERSE_DISPLAY_COOKIE_NAME } from "@/lib/home-prayer-pools/constants";
import {
  normalizeGoldenVerseFontFamily,
  normalizeGoldenVerseTextEffect,
} from "@/lib/home-prayer-pools/golden-verse-normalize";
import { themeRepeatPoolScopeId } from "@/lib/scripture/theme-repeat-pool-scope-id";

export { normalizeGoldenVerseFontFamily, normalizeGoldenVerseTextEffect };

export { VERSE_DISPLAY_COOKIE_NAME };

const VERSE_DISPLAY_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

/** RSC 读 Cookie：与 `writeHomePrayerVersePrefs` 写入值一致 */
export function verseDisplayModeFromCookieValue(raw: string | null | undefined): VerseDisplayModeV1 {
  if (raw === "bilingual") return "bilingual";
  return "primary";
}

export function persistVerseDisplayToCookie(display: VerseDisplayModeV1): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${VERSE_DISPLAY_COOKIE_NAME}=${display};path=/;max-age=${VERSE_DISPLAY_COOKIE_MAX_AGE_SEC};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export const DEFAULT_HOME_PRAYER_PREFS: HomePrayerVersePrefsV1 = {
  version: 1,
  verseScope: { type: "all" },
  verseDisplay: "primary",
  verseTextZhTranslationId: "cuv-simp",
  verseTextEnTranslationId: "web-en",
  memoryByNamespace: {},
  goldenVerseFontFamily: "sans",
  goldenVerseTextEffect: "insetCarved",
};

/** 任意 prefs 写入后派发（同标签页）；用于金句页字体等无需重拉祷告池的 UI 同步 */
export const HOME_PRAYER_PREFS_UPDATED_EVENT = "selah:home-prayer-verse-prefs-updated";

export function normalizeVerseZhTranslationId(raw: unknown): string {
  const s = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  return s || "cuv-simp";
}

export function normalizeVerseEnTranslationId(raw: unknown): string {
  const s = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  return s || "web-en";
}

export function memoryNamespaceFromScope(scope: VerseScopeV1): string {
  if (scope.type === "all") return "all";
  if (scope.type === "themeRepeat") return themeRepeatPoolScopeId(scope.minCount);
  return `cat:${scope.categoryId}`;
}

export function readHomePrayerVersePrefs(): HomePrayerVersePrefsV1 {
  if (typeof window === "undefined") return DEFAULT_HOME_PRAYER_PREFS;
  try {
    const raw = window.localStorage.getItem(HOME_PRAYER_PREFS_STORAGE_KEY);
    if (!raw?.trim()) return DEFAULT_HOME_PRAYER_PREFS;
    const p = JSON.parse(raw) as Partial<HomePrayerVersePrefsV1>;
    if (p?.version !== 1) return DEFAULT_HOME_PRAYER_PREFS;
    const verseScope = normalizeScope(p.verseScope);
    const verseDisplay: VerseDisplayModeV1 = p.verseDisplay === "bilingual" ? "bilingual" : "primary";
    const memoryByNamespace =
      p.memoryByNamespace && typeof p.memoryByNamespace === "object" && !Array.isArray(p.memoryByNamespace)
        ? (p.memoryByNamespace as HomePrayerVersePrefsV1["memoryByNamespace"])
        : {};
    return {
      version: 1,
      verseScope,
      verseDisplay,
      verseTextZhTranslationId: normalizeVerseZhTranslationId(p.verseTextZhTranslationId),
      verseTextEnTranslationId: normalizeVerseEnTranslationId(p.verseTextEnTranslationId),
      memoryByNamespace,
      goldenVerseFontFamily: normalizeGoldenVerseFontFamily(p.goldenVerseFontFamily),
      goldenVerseTextEffect: normalizeGoldenVerseTextEffect(p.goldenVerseTextEffect),
    };
  } catch {
    return DEFAULT_HOME_PRAYER_PREFS;
  }
}

function normalizeScope(raw: unknown): VerseScopeV1 {
  if (raw && typeof raw === "object") {
    const o = raw as { type?: string; categoryId?: string; minCount?: number };
    if (o.type === "themeRepeat") {
      const min = Number(o.minCount);
      if (Number.isFinite(min) && min >= 1) return { type: "themeRepeat", minCount: Math.floor(min) };
    }
    if (o.type === "category" && typeof o.categoryId === "string" && o.categoryId.trim()) {
      return { type: "category", categoryId: o.categoryId.trim() };
    }
  }
  return { type: "all" };
}

export function writeHomePrayerVersePrefs(next: HomePrayerVersePrefsV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_PRAYER_PREFS_STORAGE_KEY, JSON.stringify(next));
    persistVerseDisplayToCookie(next.verseDisplay);
    window.dispatchEvent(new Event(HOME_PRAYER_PREFS_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

/** 与 `useHomePrayerVerseFeed` 内监听配对；仅在用户改范围/双语/译本/重置经句顺序等需重拉池时调用，勿在逐节记忆写入时调用。 */
export const HOME_PRAYER_VERSE_FEED_RELOAD_EVENT = "selah:home-prayer-verse-feed-reload";

export function requestHomePrayerVerseFeedReload(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOME_PRAYER_VERSE_FEED_RELOAD_EVENT));
}

export function scopeIdFromPrefs(scope: VerseScopeV1): string {
  if (scope.type === "themeRepeat") return themeRepeatPoolScopeId(scope.minCount);
  if (scope.type === "category") return `cat-${scope.categoryId}`;
  return "all";
}

export function verseTranslationIdsFromPrefs(prefs: HomePrayerVersePrefsV1): { zh: string; en: string } {
  return {
    zh: normalizeVerseZhTranslationId(prefs.verseTextZhTranslationId),
    en: normalizeVerseEnTranslationId(prefs.verseTextEnTranslationId),
  };
}
