import "server-only";

import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "@/lib/bible/translations-types";
import type { AppLocale } from "@/lib/i18n/config";
import {
  type ParsedExploreRef,
  formatExploreRefLabel,
  parseExploreRef,
} from "./explore-scripture-ref-parse";

export type { ParsedExploreRef } from "./explore-scripture-ref-parse";
export { formatExploreRefLabel, parseExploreRef } from "./explore-scripture-ref-parse";

function translationIdForLocale(locale: AppLocale): string {
  if (locale === "en") return "web-en";
  if (locale === "zh-TW") return "cuv-trad";
  return DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

function verseTextForParsedRef(
  chapterText: { verse: number; text: string }[],
  ref: ParsedExploreRef,
): string | null {
  const byVerse = new Map<number, string>();
  for (const row of chapterText) byVerse.set(row.verse, row.text);
  const parts = ref.verseList.map((v) => byVerse.get(v)?.trim() ?? "").filter(Boolean);
  if (!parts.length) return null;
  const hasHan = parts.some((line) => /[\p{Script=Han}]/u.test(line));
  return parts.join(hasHan ? "" : " ");
}

export async function loadExploreRefVerseTexts(args: {
  refs: string[];
  bookAbbrMap: Record<string, string>;
  locale: AppLocale;
}): Promise<Record<string, string>> {
  const cwd = process.cwd();
  const translationId = translationIdForLocale(args.locale);
  const parsedByRaw = Object.fromEntries(
    args.refs.map((raw) => [raw, parseExploreRef(raw, args.bookAbbrMap)] as const),
  ) as Record<string, ParsedExploreRef | null>;

  const chapterCache = new Map<string, Awaited<ReturnType<typeof loadChapterFromTranslation>>>();
  const uniqueChapters = Array.from(
    new Set(
      Object.values(parsedByRaw)
        .filter((row): row is ParsedExploreRef => row != null)
        .map((row) => `${row.bookId}:${row.chapter}`),
    ),
  );

  await Promise.all(
    uniqueChapters.map(async (chapterKey) => {
      const [bookId, chapterRaw] = chapterKey.split(":");
      const loaded = await loadChapterFromTranslation(cwd, bookId, Number(chapterRaw), translationId);
      chapterCache.set(chapterKey, loaded);
    }),
  );

  const pending = args.locale === "en" ? "Verse unavailable." : "经文正文暂缺";
  const out: Record<string, string> = {};
  for (const raw of args.refs) {
    const parsed = parsedByRaw[raw];
    if (!parsed) {
      out[raw] = pending;
      continue;
    }
    const loaded = chapterCache.get(`${parsed.bookId}:${parsed.chapter}`);
    out[raw] = (loaded ? verseTextForParsedRef(loaded.verses, parsed) : null) ?? pending;
  }
  return out;
}


/** 与 `SUPPORTED_LOCALES` 对齐；显式列出以便返回值类型是完整的 Record。 */
const EXPLORE_VERSE_LOCALES = ["zh-CN", "zh-TW", "en"] as const;

export type ExploreVerseTextsByLocale = Record<AppLocale, Record<string, string>>;

/**
 * 一次取齐所有语言的经文文本。
 *
 * 页面原先按请求语言只取一份，这就要求服务端读 cookie/Accept-Language，整站因此被迫
 * 动态渲染。改为全语言一起返回后页面可静态生成，由客户端按 `useLocale()` 选用；
 * 附带的好处是切换语言不再需要刷新。三种语言合计也就几十 KB，值这个交换。
 */
export async function loadExploreRefVerseTextsAllLocales(args: {
  refs: string[];
  bookAbbrMap: Record<string, string>;
}): Promise<ExploreVerseTextsByLocale> {
  const entries = await Promise.all(
    EXPLORE_VERSE_LOCALES.map(
      async (locale) =>
        [locale, await loadExploreRefVerseTexts({ ...args, locale })] as const,
    ),
  );
  return Object.fromEntries(entries) as ExploreVerseTextsByLocale;
}
