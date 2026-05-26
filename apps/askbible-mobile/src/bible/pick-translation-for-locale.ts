/** 与 `lib/bible/pick-translation-for-locale.ts` 同构（勿引用仓库根 lib，Metro 无法打包） */
import type { AppLocale } from "../i18n/config";
import type { BibleTranslationsIndex } from "./translations-types";

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
  if (locale === "zh-CN") {
    return (
      firstMatch(index, (id, lang) => id === "cuv-simp" || lang === "zh-hans") ??
      firstMatch(index, (id, lang) => id === "cuv-trad" || lang === "zh-hant") ??
      index.defaultTranslationId
    );
  }
  return (
    firstMatch(index, (id, lang) => id === "web-en" || lang === "en") ??
    firstMatch(index, (id, lang) => id === "bbe-en") ??
    firstMatch(index, (_id, lang) => lang.startsWith("en")) ??
    index.defaultTranslationId
  );
}
