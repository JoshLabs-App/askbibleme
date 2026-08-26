import type { AppLocale } from "../i18n/config";

/**
 * 读经展示语言：跟主译本走（英文译本 → 英文面；中文译本 → 中文面），
 * 不强制改 App 全局界面语言。
 */
export function resolveReadDisplayLocale(args: {
  appLocale: AppLocale;
  translationLanguage?: string | null;
  verseSampleText?: string | null;
}): AppLocale {
  const lang = String(args.translationLanguage ?? "").trim().toLowerCase();
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("zh")) return args.appLocale === "zh-TW" ? "zh-TW" : "zh-CN";

  const sample = String(args.verseSampleText ?? "");
  if (sample) {
    if (/[\u3400-\u9FFF]/.test(sample)) {
      return args.appLocale === "zh-TW" ? "zh-TW" : "zh-CN";
    }
    if (/[A-Za-z]/.test(sample)) return "en";
  }
  return args.appLocale;
}
