import type { AppLocale } from "../i18n/config";

/** 与 Web `HomeVerseRotator` 一致：中文多行直接相接，英文行间加空格。 */
export function joinVerseLinesForFlow(lines: string[], locale: AppLocale): string {
  const parts = lines.map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  return locale === "en" ? parts.join(" ") : parts.join("");
}
