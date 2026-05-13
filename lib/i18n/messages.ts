import type { AppLocale } from "@/lib/i18n/config";
import en from "@/locales/en.json";
import zhCN from "@/locales/zh-CN.json";

export type Messages = typeof zhCN;

export const MESSAGES: Record<AppLocale, Messages> = {
  "zh-CN": zhCN,
  en: en as Messages,
};

export function getMessages(locale: AppLocale): Messages {
  return MESSAGES[locale];
}
