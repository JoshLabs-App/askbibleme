import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { pickTranslationIdForLocale } from "@/lib/bible/pick-translation-for-locale";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";
import type { VerseRef } from "@/lib/bible/verse-ref";

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

/** 将一节或连续多节正文拆成多行，便于首页排版（与旧 hand-split 接近）。 */
export function splitVerseTextToDisplayLines(text: string, locale: AppLocale): string[] {
  const t = text.trim();
  if (!t) return [];
  if (locale === "zh-CN") {
    const chunks: string[] = [];
    let buf = "";
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      buf += c;
      if ("，；".includes(c) && buf.replace(/[，；\s]/g, "").length >= 6) {
        chunks.push(buf.trim());
        buf = "";
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
    return chunks.length > 0 ? chunks : [t];
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
export function resolveVerseRefToHomeEntry(
  cwd: string,
  ref: VerseRef,
  locale: AppLocale,
  options?: ResolveVerseRefOptions,
): HomeVerseEntry | null {
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

  const loaded = loadChapterFromTranslation(cwd, ref.bookId, ref.chapter, tid);
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

  const lines: string[] = [];
  if (picked.length === 1) {
    lines.push(...splitVerseTextToDisplayLines(picked[0].text, locale));
  } else {
    for (const row of picked) {
      const one = row.text.trim();
      if (one) lines.push(one);
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

  return { lines: lines.length ? lines : [picked[0].text.trim()], ref: foot };
}
