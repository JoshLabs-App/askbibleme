/** 与 `lib/bible/pick-translation-for-locale.ts` 同构（勿引用仓库根 lib，Metro 无法打包） */
import type { AppLocale } from "../i18n/config";
import type { BibleTranslationsIndex } from "./translations-types";

/**
 * App 界面语言 → 读经主译本默认映射：
 * - zh-CN → 和合本（cuv-simp）
 * - zh-TW → 繁体和合本（cuv-trad）
 * - en → WEB（web-en），再回退 KJV 等英文译本
 */
function firstMatch(
  index: BibleTranslationsIndex,
  pred: (id: string, lang: string) => boolean,
): string | null {
  for (const t of index.translations) {
    const id = t.id?.trim();
    const lang = (t.language ?? "").trim().toLowerCase();
    if (id && pred(id, lang)) return id;
  }
  return null;
}

export function pickTranslationIdForLocale(
  index: BibleTranslationsIndex,
  locale: AppLocale,
): string | null {
  if (locale === "zh-TW") {
    return (
      firstMatch(index, (id) => id === "cuv-trad") ??
      firstMatch(index, (id, lang) => lang === "zh-hant" || id === "otb-zh-hant") ??
      firstMatch(index, (id) => id === "otb-zh-hans") ??
      firstMatch(index, (id, lang) => id === "cuv-simp" || lang === "zh-hans") ??
      index.defaultTranslationId
    );
  }
  if (locale === "zh-CN") {
    return (
      firstMatch(index, (id) => id === "cuv-simp") ??
      firstMatch(index, (id, lang) => lang === "zh-hans" || id === "otb-zh-hans") ??
      firstMatch(index, (id) => id === "otb-zh-hant") ??
      firstMatch(index, (id, lang) => id === "cuv-trad" || lang === "zh-hant") ??
      index.defaultTranslationId
    );
  }
  return (
    firstMatch(index, (id) => id === "web-en") ??
    firstMatch(index, (id) => id === "kjv") ??
    firstMatch(index, (id, lang) => lang === "en" || id === "otb-en-gb") ??
    firstMatch(index, (id, lang) => id === "bbe-en") ??
    firstMatch(index, (_id, lang) => lang.startsWith("en")) ??
    index.defaultTranslationId
  );
}
