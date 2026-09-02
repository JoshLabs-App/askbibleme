import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

const REDEMPTION_ERA_BY_SECTION_ID_ZH: Record<string, string> = {
  creation: "创造",
  "finite-days": "堕落",
  "sin-death": "定罪",
  redemption: "基督救赎",
  "repent-believe": "悔改相信",
  rebirth: "重生",
  "abide-faith": "今世持守",
  "eternal-hope": "永生",
};

const REDEMPTION_ERA_BY_SECTION_ID_EN: Record<string, string> = {
  creation: "Creation",
  "finite-days": "Fall",
  "sin-death": "Judgment",
  redemption: "Redemption",
  "repent-believe": "Repentance",
  rebirth: "New Birth",
  "abide-faith": "Perseverance",
  "eternal-hope": "Eternal Life",
};

export function getRedemptionEraBySectionId(locale: AppLocale): Record<string, string> {
  if (locale === "en") return REDEMPTION_ERA_BY_SECTION_ID_EN;
  const zh = REDEMPTION_ERA_BY_SECTION_ID_ZH;
  if (locale !== "zh-TW") return zh;
  return Object.fromEntries(Object.entries(zh).map(([key, value]) => [key, toZhTwText(value)]));
}

export function getRedemptionTimelineCaption(locale: AppLocale): string {
  if (locale === "en") return "History of Redemption";
  return toZhTwText("救赎史");
}
