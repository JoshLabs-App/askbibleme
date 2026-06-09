import type { AppLocale } from "../i18n/config";
import type { ChapterSegment } from "./types";

function isHanText(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}

/** 主译本为英文时，T1 / 分段标题跟译本走，不跟 App 界面语言。 */
export function preferEnglishChapterSegmentTitles(
  translationId: string,
  language?: string | null,
): boolean {
  const lang = String(language ?? "").trim().toLowerCase();
  if (lang.startsWith("en")) return true;
  const id = String(translationId ?? "").trim().toLowerCase();
  if (!id) return false;
  return id.endsWith("-en") || id === "kjv" || id === "asv" || id === "web-en";
}

/** 分段标题：英文译本只显示英文 T1，中文译本显示中文。 */
export function resolveChapterSegmentHeadingText(
  row: ChapterSegment,
  locale: AppLocale,
  toZhTw?: (text: string) => string,
  preferEnglishTitles = false,
): string {
  const en = String(row.title || "").trim();
  const zh = String(row.titleZh || row.title || "").trim();

  let raw = "";
  if (locale === "en" || preferEnglishTitles) {
    if (en && !isHanText(en)) raw = en;
  } else {
    raw = zh || en;
  }

  if (!raw) return "";
  if (locale === "zh-TW" && toZhTw && !preferEnglishTitles) return toZhTw(raw).trim();
  return raw.trim();
}
