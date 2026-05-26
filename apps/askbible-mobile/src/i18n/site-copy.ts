import { getLocale } from "./locale-store";
import type { AppLocale } from "./config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zhCN = require("../../assets/content/zh-CN.json") as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const en = require("../../assets/content/en.json") as Record<string, unknown>;

const MESSAGES: Record<AppLocale, Record<string, unknown>> = {
  "zh-CN": zhCN,
  en,
};

export type SiteCopyVars = Record<string, string | number>;

function walk(obj: unknown, parts: string[]): unknown {
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function translate(locale: AppLocale, keyPath: string, vars?: SiteCopyVars): string {
  const primary = MESSAGES[locale];
  const fallbacks = locale === "zh-CN" ? [MESSAGES.en] : [MESSAGES["zh-CN"]];
  for (const bundle of [primary, ...fallbacks]) {
    const hit = walk(bundle, keyPath.split("."));
    if (typeof hit === "string" && hit.length > 0) {
      let s = hit;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return s;
    }
  }
  return keyPath;
}

export function createT(locale: AppLocale) {
  return (keyPath: string, vars?: SiteCopyVars) => translate(locale, keyPath, vars);
}

/** 与网站 `locales/*.json` 同键路径；随 `LocaleProvider` 重挂载后使用当前语言。 */
export function t(keyPath: string): string {
  return translate(getLocale(), keyPath);
}

export function tFormat(keyPath: string, vars: SiteCopyVars): string {
  return translate(getLocale(), keyPath, vars);
}

export function resolveLocalizedField(
  field: string | { "zh-CN"?: string; en?: string } | undefined | null,
  locale: AppLocale = getLocale(),
): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  if (locale === "en") return (field.en || field["zh-CN"] || "").trim();
  return (field["zh-CN"] || field.en || "").trim();
}

/** 音乐页曲目元数据：仅英文（不读 zh-CN 语言包） */
export function resolveMusicLocalizedField(
  field: string | { "zh-CN"?: string; en?: string } | undefined | null,
): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  return (field.en || "").trim();
}
