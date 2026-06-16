import "server-only";

import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import {
  scriptureTranslationIdForLocale,
  scriptureTranslationLabelForLocale,
} from "@/lib/bible/scripture-translation-for-locale";
import type { AppLocale } from "@/lib/i18n/config";
import type { FigureScriptureRef } from "./types";
import { figureRefKey, verseListFromFigureRef } from "./figure-ref";

function verseTextForRef(
  chapterText: { verse: number; text: string }[],
  ref: FigureScriptureRef,
): string | null {
  const byVerse = new Map<number, string>();
  for (const row of chapterText) byVerse.set(row.verse, row.text);
  const parts = verseListFromFigureRef(ref)
    .map((v) => byVerse.get(v)?.trim() ?? "")
    .filter(Boolean);
  if (!parts.length) return null;
  const hasHan = parts.some((line) => /[\p{Script=Han}]/u.test(line));
  return parts.join(hasHan ? "" : " ");
}

export async function loadFigureRefVerseTexts(args: {
  refs: FigureScriptureRef[];
  locale: AppLocale;
}): Promise<Record<string, string>> {
  const cwd = process.cwd();
  const translationId = scriptureTranslationIdForLocale(cwd, args.locale);
  const pending = args.locale === "en" ? "Verse unavailable." : "经文正文暂缺";

  const chapterCache = new Map<string, Awaited<ReturnType<typeof loadChapterFromTranslation>>>();
  const uniqueChapters = Array.from(
    new Set(args.refs.map((ref) => `${ref.bookId}:${ref.chapter}`)),
  );

  await Promise.all(
    uniqueChapters.map(async (chapterKey) => {
      const [bookId, chapterRaw] = chapterKey.split(":");
      const loaded = await loadChapterFromTranslation(cwd, bookId, Number(chapterRaw), translationId);
      chapterCache.set(chapterKey, loaded);
    }),
  );

  const out: Record<string, string> = {};
  for (const ref of args.refs) {
    const key = figureRefKey(ref);
    const loaded = chapterCache.get(`${ref.bookId}:${ref.chapter}`);
    out[key] = (loaded ? verseTextForRef(loaded.verses, ref) : null) ?? pending;
  }
  return out;
}

export function figureRefVerseTranslationLabel(locale: AppLocale): string {
  return scriptureTranslationLabelForLocale(process.cwd(), locale);
}
