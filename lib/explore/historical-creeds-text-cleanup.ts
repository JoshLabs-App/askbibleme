import {
  cleanupHistoricalCreedEnglishText,
  collapseCjkInteriorSpaces,
  normalizeHistoricalCreedChineseText,
  removeConfessionFootnoteDigits,
  stripBrokenCcelHtmlRemnants,
} from "./historical-creeds-text-cleanup.mjs";

export {
  cleanupHistoricalCreedEnglishText,
  collapseCjkInteriorSpaces,
  normalizeHistoricalCreedChineseText,
  removeConfessionFootnoteDigits,
  stripBrokenCcelHtmlRemnants,
};

export function cleanupHistoricalCreedBodyParagraph(text: string, locale: "zh" | "en"): string {
  if (locale === "en") return cleanupHistoricalCreedEnglishText(text);
  return normalizeHistoricalCreedChineseText(text);
}
