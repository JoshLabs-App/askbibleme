import type { AppLocale } from "@/lib/i18n/config";

/** 曲库等内容数据：纯字符串视为中文；对象可同时提供英文 */
export type LocalizedField = string | { "zh-CN": string; en?: string };

export function primaryLocaleText(field: LocalizedField | undefined | null): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  return (field["zh-CN"] ?? "").trim();
}

export function resolveLocalized(
  field: LocalizedField | undefined | null,
  locale: AppLocale,
): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  const zh = (field["zh-CN"] ?? "").trim();
  if (locale === "en") {
    const en = field.en?.trim();
    if (en) return en;
  }
  return zh;
}
