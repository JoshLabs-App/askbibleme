import { askbibleReadPath } from "@/lib/bible/parse-askbible-read-link";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { NARROW_GATE_BOOK_ABBR_TO_ID } from "@/lib/explore/narrow-gate-content";
import { PRAISE_WORSHIP_BOOK_ABBR_TO_ID } from "@/lib/explore/praise-worship-content";
import { PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID } from "@/lib/explore/prayer-scripture-content";
import { WORD_OF_GOD_BOOK_ABBR_TO_ID } from "@/lib/explore/word-of-god-content";

type BookToken = { token: string; bookId: string };

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
      if (!entries.has(token)) entries.set(token, bookId);
    }
  }
  return [...entries.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([token, bookId]) => ({ token, bookId }));
}

const BOOK_TOKENS = buildBookTokens();
const BOOK_PATTERN = BOOK_TOKENS.map(({ token }) => escapeRegex(token)).join("|");
const TOKEN_TO_ID = new Map(BOOK_TOKENS.map(({ token, bookId }) => [token, bookId]));

const SCRIPTURE_REF_RE = new RegExp(
  `(?:《(${BOOK_PATTERN})》|(${BOOK_PATTERN}))\\s*(?:` +
    `(\\d+)\\s*[:：]\\s*([\\d]+(?:\\s*[–\\-—]\\s*\\d+)?(?:\\s*[,;]\\s*(?:\\d+\\s*[:：]\\s*)?\\d+(?:\\s*[–\\-—]\\s*\\d+)?)*)` +
    `|` +
    `(\\d+)\\s*章` +
    `)(?![\\d:：章])`,
  "g",
);

function parseFirstVerse(verseSpec: string): number | undefined {
  const cleaned = verseSpec.replace(/[–—]/g, "-").split(/[,;]/)[0]?.trim() ?? "";
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

function linkifySegment(text: string): string {
  return text.replace(
    SCRIPTURE_REF_RE,
    (full, guillemetBook: string | undefined, plainBook: string | undefined, chapterNum: string | undefined, verseSpec: string | undefined, chapterOnly: string | undefined) => {
      const bookName = (guillemetBook || plainBook || "").trim();
      const bookId = TOKEN_TO_ID.get(bookName);
      if (!bookId) return full;

      const chapter = Number(chapterOnly || chapterNum);
      if (!Number.isInteger(chapter) || chapter < 1) return full;

      const verse = verseSpec ? parseFirstVerse(verseSpec) : undefined;
      const path = askbibleReadPath({ bookId, chapter, verse });
      return `[${full}](${path})`;
    },
  );
}

/** Turn inline Chinese scripture refs into markdown links to read chapter pages. */
export function linkifyExploreArticleScriptureRefs(markdown: string): string {
  if (!markdown.trim()) return markdown;

  const protectedChunks: string[] = [];
  const withProtected = markdown.replace(
    /```[\s\S]*?```|`[^`]+`|\[[^\]]+\]\([^)]+\)/g,
    (match) => {
      const index = protectedChunks.push(match) - 1;
      return `\u0000PROTECTED${index}\u0000`;
    },
  );

  const linked = linkifySegment(withProtected);

  return linked.replace(/\u0000PROTECTED(\d+)\u0000/g, (_match, indexRaw: string) => {
    const index = Number(indexRaw);
    return protectedChunks[index] ?? _match;
  });
}
