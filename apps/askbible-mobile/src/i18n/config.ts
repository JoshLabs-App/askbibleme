import { NativeModules, Platform } from "react-native";

/** 与网站 `lib/i18n/config.ts`、`locales/*.json` 对齐 */
export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh-CN";

export const LOCALE_STORAGE_KEY = "askbible-locale-v1";
export const LOCALE_STORAGE_KEY_LEGACY = "selah-locale-v1";

export function parseLocale(raw: string | null | undefined): AppLocale {
  if (raw === "en" || raw === "zh-CN") return raw;
  return DEFAULT_LOCALE;
}

export function mapLanguageTagToAppLocale(tag: string): AppLocale {
  const t = tag.trim().toLowerCase();
  if (!t) return DEFAULT_LOCALE;
  if (t === "en" || t.startsWith("en-")) return "en";
  if (t.startsWith("zh")) return "zh-CN";
  return DEFAULT_LOCALE;
}

function inferLanguageTagFromNativeModules(): string {
  if (Platform.OS === "ios") {
    const settings = (NativeModules as { SettingsManager?: { settings?: Record<string, unknown> } })
      .SettingsManager?.settings;
    const appleLanguages = settings?.AppleLanguages;
    if (Array.isArray(appleLanguages) && typeof appleLanguages[0] === "string") {
      const tag = appleLanguages[0].trim();
      if (tag) return tag;
    }
    const appleLocale = settings?.AppleLocale;
    if (typeof appleLocale === "string" && appleLocale.trim()) {
      return appleLocale.trim();
    }
  }

  if (Platform.OS === "android") {
    const localeIdentifier = (
      NativeModules as { I18nManager?: { localeIdentifier?: unknown } }
    ).I18nManager?.localeIdentifier;
    if (typeof localeIdentifier === "string" && localeIdentifier.trim()) {
      return localeIdentifier.replace("_", "-").trim();
    }
  }

  return "";
}

export function inferAppLocaleFromDevice(): AppLocale {
  try {
    const nativeTag = inferLanguageTagFromNativeModules();
    if (nativeTag) return mapLanguageTagToAppLocale(nativeTag);
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    if (tag) return mapLanguageTagToAppLocale(tag);
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}
