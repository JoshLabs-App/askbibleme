import type { AppLocale } from "@/lib/i18n/config";
import { pickTranslationIdForLocale } from "@/lib/bible/pick-translation-for-locale";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "@/lib/bible/translations-types";

const PREFERRED_TRANSLATION_IDS: Partial<Record<AppLocale, readonly string[]>> = {
  "zh-CN": ["cuv-simp"],
  "zh-TW": ["cuv-trad"],
  en: ["web-en", "asv", "bbe-en"],
};

function resolvePreferredTranslationId(cwd: string, locale: AppLocale): string {
  const index = readTranslationsIndexSync(cwd);
  const preferred = PREFERRED_TRANSLATION_IDS[locale] ?? [];
  for (const id of preferred) {
    if (index.translations.some((row) => row.id === id)) return id;
  }
  return pickTranslationIdForLocale(index, locale) ?? DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

export function scriptureTranslationIdForLocale(cwd: string, locale: AppLocale): string {
  return resolvePreferredTranslationId(cwd, locale);
}

export function scriptureTranslationLabelForLocale(cwd: string, locale: AppLocale): string {
  const index = readTranslationsIndexSync(cwd);
  const translationId = resolvePreferredTranslationId(cwd, locale);
  const meta = index.translations.find((row) => row.id === translationId);
  if (locale === "en") return meta?.labelEn ?? "World English Bible";
  return meta?.labelZh ?? (locale === "zh-TW" ? "和合本（繁體）" : "和合本（简体）");
}
