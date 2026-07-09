import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppLocale } from "../i18n/config";

/** 与网站 `HOME_PRAYER_PREFS_STORAGE_KEY` 一致，便于日后同步 */
export const HOME_PRAYER_PREFS_STORAGE_KEY = "askbible-home-verse-prefs-v1";
export const HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY = "selah-home-verse-prefs-v1";

export const HOME_PRAYER_PREFS_UPDATED_EVENT = "selah:home-prayer-verse-prefs-updated";
const listeners = new Set<() => void>();

function emitPrefsUpdated() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  });
}

export type VerseDisplayModeV1 = "primary" | "bilingual";
export type HomePrimaryTranslationMode = "auto" | "manual";

export type HomePrayerVersePrefsV1 = {
  version: 1;
  verseDisplay: VerseDisplayModeV1;
  /** auto: 跟随软件语言；manual: 使用用户手选主译本 */
  primaryTranslationMode: HomePrimaryTranslationMode;
  /** 第一版本（移动版 UI；与网站 JSON 字段名一致） */
  verseTextZhTranslationId: string;
  /** 第二版本，空 = 不显示；任意译本 id */
  verseTextEnTranslationId: string;
};

export const DEFAULT_HOME_PRAYER_PREFS: HomePrayerVersePrefsV1 = {
  version: 1,
  verseDisplay: "primary",
  primaryTranslationMode: "auto",
  verseTextZhTranslationId: "cuv-simp",
  verseTextEnTranslationId: "",
};

export function defaultHomePrimaryTranslationIdForLocale(locale: AppLocale): string {
  if (locale === "en") return "kjv";
  if (locale === "zh-TW") return "cuv-trad";
  return "cuv-simp";
}

function normalizePrimaryTranslationMode(raw: unknown): HomePrimaryTranslationMode {
  return raw === "manual" ? "manual" : "auto";
}

export function normalizeVerseZhTranslationId(raw: unknown): string {
  const s = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  return s || "cuv-simp";
}

export function normalizeVerseEnTranslationId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

export async function readHomePrayerVersePrefs(): Promise<HomePrayerVersePrefsV1> {
  try {
    const raw =
      (await AsyncStorage.getItem(HOME_PRAYER_PREFS_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY));
    if (!raw?.trim()) return DEFAULT_HOME_PRAYER_PREFS;
    await AsyncStorage.setItem(HOME_PRAYER_PREFS_STORAGE_KEY, raw);
    await AsyncStorage.removeItem(HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY);
    const p = JSON.parse(raw) as Partial<HomePrayerVersePrefsV1>;
    if (p?.version !== 1) return DEFAULT_HOME_PRAYER_PREFS;
    const normalizedPrimary = normalizeVerseZhTranslationId(p.verseTextZhTranslationId);
    const normalizedContrast = normalizeVerseEnTranslationId(p.verseTextEnTranslationId);
    const modeFromStorage = normalizePrimaryTranslationMode(
      (p as Partial<HomePrayerVersePrefsV1> & { primaryTranslationMode?: unknown }).primaryTranslationMode,
    );
    // 兼容旧数据：未写 mode 时，若仍是默认主译本且无对照译本，则视作未手改（auto）。
    const inferredMode: HomePrimaryTranslationMode =
      (p as Partial<HomePrayerVersePrefsV1> & { primaryTranslationMode?: unknown }).primaryTranslationMode ==
      null
        ? normalizedPrimary === "cuv-simp" && !normalizedContrast
          ? "auto"
          : "manual"
        : modeFromStorage;
    return {
      version: 1,
      verseDisplay: p.verseDisplay === "bilingual" ? "bilingual" : "primary",
      primaryTranslationMode: inferredMode,
      verseTextZhTranslationId: normalizedPrimary,
      verseTextEnTranslationId: normalizedContrast,
    };
  } catch {
    return DEFAULT_HOME_PRAYER_PREFS;
  }
}

export async function writeHomePrayerVersePrefs(next: HomePrayerVersePrefsV1): Promise<void> {
  const normalized: HomePrayerVersePrefsV1 = {
    version: 1,
    verseDisplay: next.verseDisplay === "bilingual" ? "bilingual" : "primary",
    primaryTranslationMode: normalizePrimaryTranslationMode(next.primaryTranslationMode),
    verseTextZhTranslationId: normalizeVerseZhTranslationId(next.verseTextZhTranslationId),
    verseTextEnTranslationId: normalizeVerseEnTranslationId(next.verseTextEnTranslationId),
  };
  await AsyncStorage.setItem(HOME_PRAYER_PREFS_STORAGE_KEY, JSON.stringify(normalized));
  await AsyncStorage.removeItem(HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY);
  emitPrefsUpdated();
}

export function subscribeHomePrayerVersePrefs(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function verseTranslationIdsFromPrefs(
  prefs: HomePrayerVersePrefsV1,
  locale: AppLocale,
): {
  primary: string;
  contrast: string;
} {
  const primary =
    prefs.primaryTranslationMode === "manual"
      ? normalizeVerseZhTranslationId(prefs.verseTextZhTranslationId)
      : defaultHomePrimaryTranslationIdForLocale(locale);
  return {
    primary,
    contrast: normalizeVerseEnTranslationId(prefs.verseTextEnTranslationId),
  };
}

/** 经文多行拼接用：按译本 id 推断中文/英文流式规则 */
export function flowLocaleForHomeVerseTranslationId(translationId: string | undefined | null): AppLocale {
  const id = String(translationId ?? "").trim().toLowerCase();
  if (!id) return "en";
  if (id === "cuv-trad" || id.includes("hant")) return "zh-TW";
  if (id.startsWith("cuv") || id.includes("zh")) return "zh-CN";
  return "en";
}
