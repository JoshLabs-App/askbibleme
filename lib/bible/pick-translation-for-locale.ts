/**
 * 产品拍板（多语言首页经文）：
 * - **同一套 `VerseRef`**，按界面语言 **切换译本文件**：`zh-CN` → 优先 `cuv-simp`，`en` → 优先 `kjv`，再回退其它英文译本。
 * - 不是「仅脚注本地化、正文永远 `defaultTranslation`」。
 */
import type { AppLocale } from "@/lib/i18n/config";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";

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

/** 首页轮播等：实现见文件头「产品拍板」。 */
export function pickTranslationIdForLocale(index: BibleTranslationsIndex, locale: AppLocale): string | null {
  if (locale === "zh-TW") {
    return (
      firstMatch(index, (id, lang) => id === "cuv-trad" || lang === "zh-hant") ??
      firstMatch(index, (id, lang) => id === "cuv-simp" || lang === "zh-hans") ??
      index.defaultTranslationId
    );
  }
  if (locale === "zh-CN") {
    return (
      firstMatch(index, (id, lang) => id === "cuv-simp" || lang === "zh-hans") ??
      firstMatch(index, (id, lang) => id === "cuv-trad" || lang === "zh-hant") ??
      index.defaultTranslationId
    );
  }
  return (
    firstMatch(index, (id) => id === "kjv") ??
    firstMatch(index, (id) => id === "web-en") ??
    firstMatch(index, (id, lang) => id === "bbe-en") ??
    firstMatch(index, (_id, lang) => lang.startsWith("en")) ??
    index.defaultTranslationId
  );
}
