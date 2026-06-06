/** 与 `locales/*.json` 对齐；新增语言时同步增加目录与 `MESSAGES`。 */
export const SUPPORTED_LOCALES = ["en", "zh-TW", "zh-CN"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh-CN";

export const LOCALE_STORAGE_KEY = "selah-locale-v1";

/** 供 SSR 与 `setLocale` 同步，避免首屏语言与客户端 `localStorage` 不一致导致水合错位 */
export const LOCALE_COOKIE_NAME = "selah_locale";

const LOCALE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

export function parseLocale(raw: string | null | undefined): AppLocale {
  if (raw === "en" || raw === "zh-CN" || raw === "zh-TW") return raw;
  return DEFAULT_LOCALE;
}

/**
 * 将 BCP 47 语言标签映射到已支持的应用语言。
 * 非中文、非英文（如 ja、fr）回落 **`en`**：产品仅完整维护中英文案，其余语言无包时用英文而非中文。
 */
export function mapLanguageTagToAppLocale(tag: string): AppLocale {
  const t = tag.trim().toLowerCase();
  if (!t) return DEFAULT_LOCALE;
  if (t === "en" || t.startsWith("en-")) return "en";
  if (
    t === "zh-tw" ||
    t === "zh-hk" ||
    t === "zh-mo" ||
    t.includes("hant")
  ) {
    return "zh-TW";
  }
  if (t.startsWith("zh")) return "zh-CN";
  return "en";
}

/** 从 `Accept-Language` 取首选语言（SSR / 首请求）。 */
export function inferAppLocaleFromAcceptLanguage(header: string | null | undefined): AppLocale {
  if (!header?.trim()) return DEFAULT_LOCALE;
  const first = header.split(",")[0]?.trim()?.split(";")[0]?.trim();
  if (!first) return DEFAULT_LOCALE;
  return mapLanguageTagToAppLocale(first);
}

/** 从浏览器 / WebView 的 `navigator` 取首选语言（设备 UI 语言）。 */
export function inferAppLocaleFromNavigator(): AppLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const raw = (navigator.languages?.[0] ?? navigator.language ?? "").trim();
  if (!raw) return DEFAULT_LOCALE;
  return mapLanguageTagToAppLocale(raw);
}

export function persistLocaleToCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=${LOCALE_COOKIE_MAX_AGE_SEC};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
