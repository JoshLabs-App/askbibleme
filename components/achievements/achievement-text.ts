"use client";

import type { MedalText } from "@/lib/achievements/medal-catalog";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

export type AchievementLocale = "zh-CN" | "zh-TW" | "en" | string;

/** 勋章文案只写简体 + 英文，繁体由运行时转（与 medals.json 的说明一致） */
export function medalText(text: MedalText, locale: AchievementLocale): string {
  if (locale === "en") return text.en;
  return locale === "zh-TW" ? toZhTwText(text.zh) : text.zh;
}

/** 条件文案里的 {n} 换成该档的门槛 */
export function medalCondition(text: MedalText, tier: number, locale: AchievementLocale): string {
  return medalText(text, locale).replace("{n}", String(tier));
}

export function pickLocaleText(zh: string, en: string, locale: AchievementLocale): string {
  if (locale === "en") return en;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}
