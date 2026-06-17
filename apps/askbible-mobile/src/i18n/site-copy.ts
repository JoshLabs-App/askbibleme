import { getLocale } from "./locale-store";
import type { AppLocale } from "./config";
import { ZH_TW_OVERRIDES } from "./site-copy-zh-tw-overrides";
import { ZH_TW_CHAR_MAP, ZH_TW_PHRASE_REPLACEMENTS } from "./site-copy-zh-tw-maps";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zhCN = require("../../assets/content/zh-CN.json") as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const en = require("../../assets/content/en.json") as Record<string, unknown>;
const zhTW = zhCN;

const MESSAGES: Record<AppLocale, Record<string, unknown>> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  en,
};

export function toZhTwText(input: string): string {
  let out = input;
  for (const [from, to] of ZH_TW_PHRASE_REPLACEMENTS) {
    out = out.replaceAll(from, to);
  }
  return Array.from(out, (ch) => ZH_TW_CHAR_MAP[ch] ?? ch).join("");
}

/** 简体源文案在 zh-TW 下转为繁体；其它 locale 原样返回。 */
export function localizeZhText(locale: AppLocale, text: string): string {
  return locale === "zh-TW" ? toZhTwText(text) : text;
}

/** 界面双语文案：en 走英文，zh-CN/zh-TW 走简体源并在 zh-TW 下转繁体。 */
export function resolveUiText(locale: AppLocale, zhCN: string, en: string): string {
  if (locale === "en") return en;
  return localizeZhText(locale, zhCN);
}

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
  if (locale === "zh-TW") {
    const hit = ZH_TW_OVERRIDES[keyPath];
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
  const primary = MESSAGES[locale];
  const fallbacks =
    locale === "en" ? [MESSAGES["zh-CN"]] : [MESSAGES["zh-CN"], MESSAGES.en];
  for (const bundle of [primary, ...fallbacks]) {
    const hit = walk(bundle, keyPath.split("."));
    if (typeof hit === "string" && hit.length > 0) {
      let s = hit;
      if (locale === "zh-TW") {
        s = toZhTwText(s);
      }
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
  const raw = (field["zh-CN"] || field.en || "").trim();
  return locale === "zh-TW" ? toZhTwText(raw) : raw;
}

/** 音乐页曲目元数据：仅英文（不读 zh-CN 语言包） */
export function resolveMusicLocalizedField(
  field: string | { "zh-CN"?: string; en?: string } | undefined | null,
): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  return (field.en || "").trim();
}
