import type { AppLocale } from "@/lib/i18n/config";

/**
 * 曲库等内容数据：纯字符串视为中文；对象至少提供 `zh-CN`，可选 `en`。
 * 将来可在对象上增加其它 BCP 47 键；解析规则见 `resolveLocalized`。
 */
export type LocalizedField = string | { "zh-CN": string; en?: string };

export function primaryLocaleText(field: LocalizedField | undefined | null): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  return (field["zh-CN"] ?? "").trim();
}

/**
 * - `zh-CN`：优先中文，缺则用英文。
 * - `en`：优先英文，缺则用中文。
 * - 将来扩展其它 `AppLocale`：优先该语言字段，缺则 **英文**，再 **中文**（与「无该语言包用英文」一致）。
 */
export function resolveLocalized(
  field: LocalizedField | undefined | null,
  locale: AppLocale,
): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();

  const bag = field as Record<string, string | undefined>;
  const zh = (bag["zh-CN"] ?? "").trim();
  const en = (bag.en ?? "").trim();

  if (locale === "zh-CN") {
    if (zh) return zh;
    return en;
  }

  if (locale === "en") {
    if (en) return en;
    return zh;
  }

  const specific = (bag[locale] ?? "").trim();
  if (specific) return specific;
  if (en) return en;
  return zh;
}
