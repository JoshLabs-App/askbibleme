import type { LoadedChapter } from "@/lib/bible/load-chapter-from-default-translation";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { resolveDefaultPrimaryTranslationId } from "@/lib/read/read-bible-translation-prefs";

/**
 * 读经章页的纯函数与类型——不碰 next/headers、fs，服务端与客户端读经页共用。
 * （原先都在 load-read-chapter-for-read-page.ts，那个文件读 cookie，客户端不能 import。）
 */

/** 主译本缺本章（如 UST 尚未发布的书卷）时的回退信息：记录用户原选译本。 */
export type ReadChapterFallbackInfo = {
  fromTranslationId: string;
  fromLabelZh: string;
  fromLabelEn: string;
};

export function formatReadChapterTitleChapterSuffix(chapter: number, locale: AppLocale): string {
  return locale === "en" ? String(chapter) : `第${chapter}章`;
}

export function formatReadChapterFallbackNotice(
  info: ReadChapterFallbackInfo,
  primary: LoadedChapter,
  locale: AppLocale,
): string {
  if (locale === "en") {
    return `This chapter isn't available in ${info.fromLabelEn} yet. Showing ${primary.labelEn} instead.`;
  }
  const zh = `${info.fromLabelZh}暂无本章，已改为显示${primary.labelZh}。`;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

/**
 * 主译本缺本章时的回退译本：按主译本语言选内置常用译本（英文 → WEB，繁体 → 和合本繁体，其它中文 → 和合本简体），
 * 都不可用时退到界面语言默认译本。
 */
export function pickFallbackTranslationId(
  index: BibleTranslationsIndex,
  primaryTranslationId: string,
  locale: AppLocale,
): string | null {
  const meta = index.translations.find((t) => t.id === primaryTranslationId);
  const lang = (meta?.language ?? "").trim().toLowerCase();
  const has = (id: string) => index.translations.some((t) => t.id === id);
  const candidates = lang.startsWith("en")
    ? ["web-en", "kjv"]
    : lang === "zh-hant"
      ? ["cuv-trad", "cuv-simp"]
      : lang.startsWith("zh")
        ? ["cuv-simp", "cuv-trad"]
        : lang.startsWith("es")
          ? ["rv1909-es", "rvg-es"]
          : [];
  for (const id of candidates) {
    if (id !== primaryTranslationId && has(id)) return id;
  }
  const byLocale = resolveDefaultPrimaryTranslationId(index, locale);
  return byLocale && byLocale !== primaryTranslationId ? byLocale : null;
}
