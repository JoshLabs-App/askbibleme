import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { pickTranslationIdForLocale } from "@/lib/bible/pick-translation-for-locale";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { stripZhVerseDisplayNotes } from "@/lib/bible/strip-zh-verse-display-notes";
import { normalizeVerseTextForHomeDisplay } from "@/lib/bible/normalize-verse-text-for-home-display";

function verseRangeSuffix(verseStart: number, verseEnd: number): string {
  if (verseStart === verseEnd) return `${verseStart}`;
  return `${verseStart}–${verseEnd}`;
}

export function formatVerseRefFootnote(ref: VerseRef, locale: AppLocale): string | null {
  const bookId = String(ref.bookId || "").trim().toUpperCase();
  const bookZh = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookZh) return null;
  const ch = ref.chapter;
  const suffix = verseRangeSuffix(ref.verseStart, ref.verseEnd);
  if (locale === "zh-CN") {
    return `${bookZh.bookName} ${ch}:${suffix}`;
  }
  const enName = SCRIPTURE_BOOK_NAME_EN[bookId] ?? bookId;
  return `${enName} ${ch}:${suffix}`;
}

/** 缺章 / 缺节 / 节内部分缺失时的策略（计划：统一在 resolver）。 */
export type ResolveVerseRefWhenIncomplete = "skip" | "ref-only" | "partial-span";

export type ResolveVerseRefOptions = {
  /** 默认 `partial-span`：有则展示已有节，脚注缩为实际起止节；全无则 `skip`。 */
  whenIncomplete?: ResolveVerseRefWhenIncomplete;
};

/** 统计「有字形」长度，用于判断是否为孤行（标点不计）。 */
function countZhContentChars(s: string): number {
  return s.replace(/[，。、；：！？「」『』""''\s\u3000]/g, "").length;
}

/**
 * 将过短的尾行并回上一行，避免「你，」等单字/双字孤行。
 * 从末行向前合并，再处理首行仍过短的情况。
 */
function mergeZhOrphanDisplayLines(lines: string[]): string[] {
  if (lines.length <= 1) return lines;
  const arr = [...lines];
  for (let i = arr.length - 1; i >= 1; i--) {
    const n = countZhContentChars(arr[i]!);
    if (n <= 2) {
      arr[i - 1] = arr[i - 1]! + arr[i]!;
      arr.splice(i, 1);
    }
  }
  if (arr.length >= 2 && countZhContentChars(arr[0]!) <= 2) {
    arr[1] = arr[0]! + arr[1]!;
    arr.shift();
  }
  return arr;
}

/** 中文：在逗号/分号处断行前先凑够一定长度，再合并孤行。 */
function splitZhVerseTextToDisplayLines(t: string): string[] {
  const trimmed = t.trim();
  if (!trimmed) return [];
  const chunks: string[] = [];
  let buf = "";
  /** 逗号前至少这么多「非逗分空白」字再断，减少碎行。 */
  const minCharsBeforeCommaBreak = 8;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]!;
    buf += c;
    if ("，；".includes(c) && buf.replace(/[，；\s]/g, "").length >= minCharsBeforeCommaBreak) {
      chunks.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  const base = chunks.length > 0 ? chunks : [trimmed];
  const merged = mergeZhOrphanDisplayLines(base);
  return merged.length > 0 ? merged : [trimmed];
}

/** 将一节或连续多节正文拆成多行，便于首页排版（与旧 hand-split 接近）。 */
export function splitVerseTextToDisplayLines(text: string, locale: AppLocale): string[] {
  const t = text.trim();
  if (!t) return [];
  if (locale === "zh-CN") {
    return splitZhVerseTextToDisplayLines(t);
  }
  const parts = t.split(/,\s+/).filter((p) => p.trim());
  if (parts.length <= 1) return [t];
  return parts.map((p) => (p.endsWith(",") ? p.slice(0, -1).trim() : p.trim())).filter(Boolean);
}

/**
 * 从已导入译本取字，生成首页轮播用的一条（单章内连续经节）。
 * 缺章 / 缺译本文件：`ref-only` 时仅返回脚注一行；默认 `skip` 返回 null。
 * 范围内部分缺节：`partial-span`（默认）用已有节正文，脚注改为实际首尾节号。
 */
export async function resolveVerseRefToHomeEntry(
  cwd: string,
  ref: VerseRef,
  locale: AppLocale,
  options?: ResolveVerseRefOptions,
): Promise<HomeVerseEntry | null> {
  const whenIncomplete: ResolveVerseRefWhenIncomplete = options?.whenIncomplete ?? "partial-span";

  const index = readTranslationsIndexSync(cwd);
  const tid =
    (ref.translationId && ref.translationId.trim()) || pickTranslationIdForLocale(index, locale) || index.defaultTranslationId;
  if (!tid) return null;

  const vs = ref.verseStart;
  const ve = ref.verseEnd;
  if (!Number.isInteger(vs) || !Number.isInteger(ve) || vs < 1 || ve < vs) return null;

  const footRequested = formatVerseRefFootnote(
    { bookId: ref.bookId.trim().toUpperCase(), chapter: ref.chapter, verseStart: vs, verseEnd: ve },
    locale,
  );

  const loaded = await loadChapterFromTranslation(cwd, ref.bookId, ref.chapter, tid);
  if (!loaded) {
    if (whenIncomplete === "ref-only" && footRequested) {
      return { lines: [footRequested], ref: footRequested };
    }
    return null;
  }

  const picked = loaded.verses.filter((x) => x.verse >= vs && x.verse <= ve);
  if (picked.length === 0) {
    if (whenIncomplete === "ref-only" && footRequested) {
      return { lines: [footRequested], ref: footRequested };
    }
    return null;
  }

  const expectedCount = ve - vs + 1;
  const hasGap = picked.length < expectedCount;

  if (hasGap && whenIncomplete === "skip") {
    return null;
  }

  if (hasGap && whenIncomplete === "ref-only" && footRequested) {
    return { lines: [footRequested], ref: footRequested };
  }

  const verseBodyForSplit = (raw: string): string => {
    const t = raw.trim();
    if (!t) return "";
    const pass = locale === "zh-CN" ? stripZhVerseDisplayNotes(t) : t;
    return normalizeVerseTextForHomeDisplay(pass);
  };

  const lines: string[] = [];
  if (picked.length === 1) {
    const body = verseBodyForSplit(picked[0].text);
    if (body) lines.push(...splitVerseTextToDisplayLines(body, locale));
  } else {
    for (const row of picked) {
      const one = verseBodyForSplit(row.text);
      if (one) lines.push(...splitVerseTextToDisplayLines(one, locale));
    }
  }

  const foot =
    hasGap && whenIncomplete === "partial-span"
      ? formatVerseRefFootnote(
          {
            bookId: loaded.bookId,
            chapter: loaded.chapter,
            verseStart: picked[0].verse,
            verseEnd: picked[picked.length - 1].verse,
          },
          locale,
        )
      : formatVerseRefFootnote(
          { bookId: loaded.bookId, chapter: loaded.chapter, verseStart: vs, verseEnd: ve },
          locale,
        );

  if (!foot) return null;

  const fallbackLine =
    normalizeVerseTextForHomeDisplay(
      locale === "zh-CN" ? stripZhVerseDisplayNotes(picked[0].text) : picked[0].text.trim(),
    ) || picked[0].text.trim();
  return { lines: lines.length ? lines : [fallbackLine || picked[0].text.trim()], ref: foot };
}
