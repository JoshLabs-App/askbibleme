import type { AppLocale } from "./config";

/** 语言切换控件上显示的自描述文案（与当前界面语言无关）。 */
export const LOCALE_PICKER_LABELS: Record<AppLocale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

export function getLocalePickerLabel(locale: AppLocale): string {
  return LOCALE_PICKER_LABELS[locale];
}
