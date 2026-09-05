import { cookies, headers } from "next/headers";
import {
  loadChapterFromTranslation,
  type LoadedChapter,
} from "@/lib/bible/load-chapter-from-default-translation";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { loadBundledChapterSegments } from "@/lib/bible/bundled-chapter-segments";
import {
  loadChapterSegmentsFromLocalDataset,
  loadChapterSegmentsFromOpenUsfm,
} from "@/lib/bible/load-chapter-segments";
import {
  resolveDefaultPrimaryTranslationId,
  resolveReadBibleTranslationPrefsFromCookies,
  resolveReadChapterPrimaryTranslationId,
} from "@/lib/read/read-bible-translation-prefs";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import { DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS } from "@/lib/read/read-bible-typography-prefs";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { AppLocale } from "@/lib/i18n/config";

export type ReadChapterContrastLoaded = {
  translationId: string;
  chapter: LoadedChapter;
};

/** 主译本缺本章（如 UST 尚未发布的书卷）时的回退信息：记录用户原选译本。 */
export type ReadChapterFallbackInfo = {
  fromTranslationId: string;
  fromLabelZh: string;
  fromLabelEn: string;
};

export type ReadChapterWithContrast = {
  primary: LoadedChapter;
  /** 非空表示 `primary` 是回退译本，原选译本见此字段。 */
  fallbackFrom: ReadChapterFallbackInfo | null;
  /** @deprecated 首项对照；请用 `contrasts` */
  contrast: LoadedChapter | null;
  contrasts: ReadChapterContrastLoaded[];
  locale: AppLocale;
  displayBookName: string;
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
function pickFallbackTranslationId(
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

/** 读经章页：按 Cookie / 默认读本加载主译本，可选多个对照译本。 */
export async function loadReadChapterForReadPage(
  bookId: string,
  chapter: number,
): Promise<ReadChapterWithContrast | null> {
  const cwd = process.cwd();
  const index = readTranslationsIndexSync(cwd);
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const prefs = resolveReadBibleTranslationPrefsFromCookies(cookieStore, index, locale);
  const primaryTranslationId = resolveReadChapterPrimaryTranslationId(prefs, index, locale);

  let primary = await loadChapterFromTranslation(
    cwd,
    bookId,
    chapter,
    primaryTranslationId,
  );
  let fallbackFrom: ReadChapterFallbackInfo | null = null;
  if (!primary) {
    const fallbackId = pickFallbackTranslationId(index, primaryTranslationId, locale);
    const fallbackChapter = fallbackId
      ? await loadChapterFromTranslation(cwd, bookId, chapter, fallbackId)
      : null;
    if (fallbackChapter) {
      const fromMeta = index.translations.find((t) => t.id === primaryTranslationId);
      primary = fallbackChapter;
      fallbackFrom = {
        fromTranslationId: primaryTranslationId,
        fromLabelZh: fromMeta?.labelZh || primaryTranslationId,
        fromLabelEn: fromMeta?.labelEn || primaryTranslationId,
      };
    }
  }
  if (!primary) return null;

  const contrasts: ReadChapterContrastLoaded[] = [];
  for (const contrastId of prefs.contrastTranslationIds) {
    const loaded = await loadChapterFromTranslation(cwd, bookId, chapter, contrastId);
    if (loaded) contrasts.push({ translationId: contrastId, chapter: loaded });
  }

  const primaryMaxVerse = primary.verses.reduce((max, row) => Math.max(max, row.verse), 0) || null;
  primary.segments =
    loadBundledChapterSegments(
      cwd,
      primary.bookId,
      primary.chapter,
      DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS.chapterSegmentMode,
    ) ??
    loadChapterSegmentsFromLocalDataset(cwd, primary.bookId, primary.chapter) ??
    (await loadChapterSegmentsFromOpenUsfm(primary.bookId, primary.chapter, primaryMaxVerse));

  return {
    primary,
    fallbackFrom,
    contrast: contrasts[0]?.chapter ?? null,
    contrasts,
    locale,
    displayBookName: getScriptureBookDisplayName(primary.bookId, locale),
  };
}
