import { scriptureBooks } from "@/lib/bible/scripture-books";
import { NARROW_GATE_BOOK_ABBR_TO_ID } from "@/lib/explore/narrow-gate-content";
import { PRAISE_WORSHIP_BOOK_ABBR_TO_ID } from "@/lib/explore/praise-worship-content";
import { PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID } from "@/lib/explore/prayer-scripture-content";
import { WORD_OF_GOD_BOOK_ABBR_TO_ID } from "@/lib/explore/word-of-god-content";
import { figureRefKey } from "@/lib/figures/figure-ref";
import type { FigureScriptureRef } from "@/lib/figures/types";

type BookToken = { token: string; bookId: string };

/** 文章里常见写法；优先于简称，避免「书」「加」等单字误匹配。 */
const ARTICLE_BOOK_ALIASES: Record<string, string> = {
  丹尼尔书: "DAN",
  但以理书: "DAN",
  俄巴底亚书: "OBA",
  约珥书: "JOL",
  阿摩司书: "AMO",
  弥迦书: "MIC",
  那鸿书: "NAM",
  哈巴谷书: "HAB",
  西番雅书: "ZEP",
  哈该书: "HAG",
  撒迦利亚书: "ZEC",
  玛拉基书: "MAL",
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBookTokens(): BookToken[] {
  const entries = new Map<string, string>();
  for (const book of scriptureBooks) {
    entries.set(book.bookName, book.bookId);
  }
  for (const map of [
    PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID,
    WORD_OF_GOD_BOOK_ABBR_TO_ID,
    NARROW_GATE_BOOK_ABBR_TO_ID,
    PRAISE_WORSHIP_BOOK_ABBR_TO_ID,
  ]) {
    for (const [token, bookId] of Object.entries(map)) {
      if (token.length <= 1) continue;
      if (!entries.has(token)) entries.set(token, bookId);
    }
  }
  for (const [token, bookId] of Object.entries(ARTICLE_BOOK_ALIASES)) {
    entries.set(token, bookId);
  }
  return [...entries.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([token, bookId]) => ({ token, bookId }));
}

const BOOK_TOKENS = buildBookTokens();
const BOOK_PATTERN = BOOK_TOKENS.map(({ token }) => escapeRegex(token)).join("|");
const TOKEN_TO_ID = new Map(BOOK_TOKENS.map(({ token, bookId }) => [token, bookId]));

/** 匹配中文经卷引用（含《》与无书名号、章-only）。 */
export const ZH_ARTICLE_SCRIPTURE_REF_RE = new RegExp(
  `(?:《(${BOOK_PATTERN})》|(${BOOK_PATTERN}))\\s*(?:` +
    `(\\d+)\\s*[:：]\\s*([\\d]+(?:\\s*[–\\-—]\\s*\\d+)?(?:\\s*[,;，；]\\s*(?:\\d+\\s*[:：]\\s*)?\\d+(?:\\s*[–\\-—]\\s*\\d+)?)*)` +
    `|` +
    `(\\d+)\\s*章` +
    `)(?![\\d:：章])`,
  "g",
);

export function parseFirstVerseFromSpec(verseSpec: string): number | undefined {
  const cleaned = verseSpec.replace(/[–—]/g, "-").split(/[,;，；]/)[0]?.trim() ?? "";
  if (!cleaned) return undefined;
  const crossChapter = cleaned.match(/^(\d+):(\d+)/);
  if (crossChapter) {
    const verse = Number(crossChapter[2]);
    return Number.isInteger(verse) && verse >= 1 ? verse : undefined;
  }
  const range = cleaned.match(/^(\d+)-/);
  if (range) {
    const verse = Number(range[1]);
    return Number.isInteger(verse) && verse >= 1 ? verse : undefined;
  }
  const single = Number(cleaned.match(/^(\d+)/)?.[1]);
  return Number.isInteger(single) && single >= 1 ? single : undefined;
}

function parseVerseRangeFromSpec(verseSpec: string): { verseStart: number; verseEnd?: number } {
  const cleaned = verseSpec.replace(/[–—]/g, "-").split(/[,;，；]/)[0]?.trim() ?? "";
  if (!cleaned) return { verseStart: 1 };

  const crossChapter = cleaned.match(/^(\d+):(\d+(?:-\d+)?)/);
  if (crossChapter) {
    return parseVerseRangeFromSpec(crossChapter[2]!);
  }

  const rangeMatch = cleaned.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const verseStart = Number(rangeMatch[1]);
    const verseEnd = Number(rangeMatch[2]);
    if (Number.isInteger(verseStart) && verseStart >= 1 && Number.isInteger(verseEnd) && verseEnd >= verseStart) {
      return { verseStart, verseEnd };
    }
  }

  const single = Number(cleaned.match(/^(\d+)/)?.[1]);
  return { verseStart: Number.isInteger(single) && single >= 1 ? single : 1 };
}

export function parseZhArticleScriptureRefMatch(
  full: string,
  guillemetBook: string | undefined,
  plainBook: string | undefined,
  chapterNum: string | undefined,
  verseSpec: string | undefined,
  chapterOnly: string | undefined,
): FigureScriptureRef | null {
  const bookName = (guillemetBook || plainBook || "").trim();
  const bookId = TOKEN_TO_ID.get(bookName);
  if (!bookId) return null;

  const chapter = Number(chapterOnly || chapterNum);
  if (!Number.isInteger(chapter) || chapter < 1) return null;

  const { verseStart, verseEnd } = verseSpec
    ? parseVerseRangeFromSpec(verseSpec)
    : { verseStart: 1, verseEnd: undefined as number | undefined };

  return { bookId, chapter, verseStart, verseEnd };
}

export function findZhArticleScriptureRefsInText(text: string): FigureScriptureRef[] {
  const refs: FigureScriptureRef[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(ZH_ARTICLE_SCRIPTURE_REF_RE)) {
    const parsed = parseZhArticleScriptureRefMatch(
      match[0],
      match[1],
      match[2],
      match[3],
      match[4],
      match[5],
    );
    if (!parsed) continue;
    const key = figureRefKey(parsed);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(parsed);
  }

  return refs;
}

export function collectZhArticleScriptureRefsFromMarkdown(markdown: string): FigureScriptureRef[] {
  if (!markdown.trim()) return [];

  const protectedChunks: string[] = [];
  const withProtected = markdown.replace(
    /```[\s\S]*?```|`[^`]+`|\[[^\]]+\]\([^)]+\)/g,
    (match) => {
      const index = protectedChunks.push(match) - 1;
      return `\u0000PROTECTED${index}\u0000`;
    },
  );

  const refs: FigureScriptureRef[] = [];
  const seen = new Set<string>();

  for (const line of withProtected.split("\n")) {
    if (line.startsWith(">")) continue;
    for (const ref of findZhArticleScriptureRefsInText(line)) {
      const key = figureRefKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
  }

  return refs;
}
