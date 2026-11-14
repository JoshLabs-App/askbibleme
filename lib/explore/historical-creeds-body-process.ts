import type { AppLocale } from "../i18n/config";
import type { HistoricalCreedBodyContent } from "./historical-creeds-bodies/types";
import {
  cleanupHistoricalCreedEnglishText,
  normalizeHistoricalCreedChineseText,
} from "./historical-creeds-text-cleanup.mjs";
import { linkifyNormalizedChineseRefs } from "./historical-creeds-scripture-links";
import { linkifyHistoricalCreedEnglishRefs } from "./historical-creeds-linkify-en";

/**
 * 信经全文的清洗 / 链接化——纯函数，不 import 任何信经正文。
 * 网页加载器（historical-creeds-body-load-web.ts）与旧 Expo 加载器（historical-creeds-body-load.ts）共用。
 */

function cleanupHistoricalCreedBodyParagraph(text: string, locale: "zh" | "en"): string {
  if (locale === "en") return cleanupHistoricalCreedEnglishText(text);
  return normalizeHistoricalCreedChineseText(text);
}

export function pickBodyLocale(content: HistoricalCreedBodyContent, locale: AppLocale): string[] {
  if (locale === "en") return content.bodyEn;
  if (locale === "zh-TW") return content.bodyZhTw;
  return content.bodyZh;
}

export function processBodyParagraphs(paragraphs: string[], locale: AppLocale): string[] {
  const bodyLocale = locale === "en" ? "en" : "zh";
  return paragraphs.map((paragraph) => {
    const cleaned = cleanupHistoricalCreedBodyParagraph(paragraph, bodyLocale);
    if (/\]\(\/read\//.test(cleaned)) return cleaned;
    return bodyLocale === "en"
      ? linkifyHistoricalCreedEnglishRefs(cleaned)
      : linkifyNormalizedChineseRefs(cleaned);
  });
}
