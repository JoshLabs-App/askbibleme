import { webChapterAudioBookNameEn } from "@/lib/bible/web-chapter-audio-book-names";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { figureRefKey } from "@/lib/figures/figure-ref";
import type { FigureScriptureRef } from "@/lib/figures/types";

type BookToken = { token: string; bookId: string };

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBookTokens(): BookToken[] {
  const entries = new Map<string, string>();
  for (const book of scriptureBooks) {
    entries.set(webChapterAudioBookNameEn(book.bookId), book.bookId);
  }
  entries.set("Song of Solomon", "SNG");
  return [...entries.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([token, bookId]) => ({ token, bookId }));
}

const BOOK_TOKENS = buildBookTokens();
const BOOK_PATTERN = BOOK_TOKENS.map(({ token }) => escapeRegex(token)).join("|");
const TOKEN_TO_ID = new Map(BOOK_TOKENS.map(({ token, bookId }) => [token, bookId]));

export const EN_ARTICLE_SCRIPTURE_REF_RE = new RegExp(
  `(?:\\()?(${BOOK_PATTERN})\\s+(?:` +
    `(\\d+)\\s*[:：]\\s*([\\d]+(?:\\s*[–\\-—]\\s*\\d+)?(?:\\s*[,;]\\s*(?:\\d+\\s*[:：]\\s*)?\\d+(?:\\s*[–\\-—]\\s*\\d+)?)*)` +
    `|` +
    `(\\d+)(?=\\s*\\))` +
    `)\\)?(?![\\d:：A-Za-z])`,
  "g",
);

export function parseEnArticleScriptureRefMatch(
  full: string,
  bookName: string | undefined,
  chapterNum: string | undefined,
  verseSpec: string | undefined,
  chapterOnly: string | undefined,
): FigureScriptureRef | null {
  const bookId = TOKEN_TO_ID.get((bookName || "").trim());
  if (!bookId) return null;

  const chapter = Number(chapterOnly || chapterNum);
  if (!Number.isInteger(chapter) || chapter < 1) return null;

  const { verseStart, verseEnd } = verseSpec
    ? parseVerseRangeFromSpec(verseSpec)
    : { verseStart: 1, verseEnd: undefined as number | undefined };

  return { bookId, chapter, verseStart, verseEnd };
}

export function findEnArticleScriptureRefsInText(text: string): FigureScriptureRef[] {
  const refs: FigureScriptureRef[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(EN_ARTICLE_SCRIPTURE_REF_RE)) {
    const parsed = parseEnArticleScriptureRefMatch(
      match[0],
      match[1],
      match[2],
      match[3],
      match[4],
    );
    if (!parsed) continue;
    const key = figureRefKey(parsed);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(parsed);
  }

  return refs;
}

export function collectEnArticleScriptureRefsFromMarkdown(markdown: string): FigureScriptureRef[] {
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
    for (const ref of findEnArticleScriptureRefsInText(line)) {
      const key = figureRefKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
  }

  return refs;
}