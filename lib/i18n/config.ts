/** 与 `locales/*.json` 对齐；新增语言时同步增加目录与 `MESSAGES`。 */
export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh-CN";

export const LOCALE_STORAGE_KEY = "selah-locale-v1";

export function parseLocale(raw: string | null | undefined): AppLocale {
  if (raw === "en" || raw === "zh-CN") return raw;
  return DEFAULT_LOCALE;
}
