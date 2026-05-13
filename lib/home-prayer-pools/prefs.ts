import type { HomePrayerVersePrefsV1, VerseDisplayModeV1, VerseScopeV1 } from "@/lib/home-prayer-pools/types";
import { HOME_PRAYER_PREFS_STORAGE_KEY } from "@/lib/home-prayer-pools/constants";

export const DEFAULT_HOME_PRAYER_PREFS: HomePrayerVersePrefsV1 = {
  version: 1,
  verseScope: { type: "all" },
  verseDisplay: "primary",
  verseTextZhTranslationId: "cuv-simp",
  verseTextEnTranslationId: "web-en",
  memoryByNamespace: {},
};

export function normalizeVerseZhTranslationId(raw: unknown): string {
  const s = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  return s || "cuv-simp";
}

export function normalizeVerseEnTranslationId(raw: unknown): string {
  const s = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  return s || "web-en";
}

export function memoryNamespaceFromScope(scope: VerseScopeV1): string {
  return scope.type === "all" ? "all" : `cat:${scope.categoryId}`;
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
    };
  } catch {
    return DEFAULT_HOME_PRAYER_PREFS;
  }
}

function normalizeScope(raw: unknown): VerseScopeV1 {
  if (!raw || typeof raw !== "object") return { type: "all" };
  const o = raw as { type?: string; categoryId?: string };
  if (o.type === "category" && typeof o.categoryId === "string" && o.categoryId.trim()) {
    return { type: "category", categoryId: o.categoryId.trim() };
  }
  return { type: "all" };
}

export function writeHomePrayerVersePrefs(next: HomePrayerVersePrefsV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_PRAYER_PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** 与 `useHomePrayerVerseFeed` 内监听配对；仅在用户改范围/双语/译本/重置复习等需重拉池时调用，勿在逐节记忆写入时调用。 */
export const HOME_PRAYER_VERSE_FEED_RELOAD_EVENT = "selah:home-prayer-verse-feed-reload";

export function requestHomePrayerVerseFeedReload(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOME_PRAYER_VERSE_FEED_RELOAD_EVENT));
}

export function scopeIdFromPrefs(scope: VerseScopeV1): string {
  return scope.type === "all" ? "all" : scope.categoryId;
}

export function verseTranslationIdsFromPrefs(prefs: HomePrayerVersePrefsV1): { zh: string; en: string } {
  return {
    zh: normalizeVerseZhTranslationId(prefs.verseTextZhTranslationId),
    en: normalizeVerseEnTranslationId(prefs.verseTextEnTranslationId),
  };
}
