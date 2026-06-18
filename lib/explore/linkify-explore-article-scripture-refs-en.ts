import { askbibleReadPath } from "../bible/parse-askbible-read-link";
import { webChapterAudioBookNameEn } from "../bible/web-chapter-audio-book-names";
import { scriptureBooks } from "../bible/scripture-books";

type BookToken = { token: string; bookId: string };

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

const SCRIPTURE_REF_RE = new RegExp(
  `(?:\\()?(${BOOK_PATTERN})\\s+(?:` +
    `(\\d+)\\s*[:：]\\s*([\\d]+(?:\\s*[–\\-—]\\s*\\d+)?(?:\\s*[,;]\\s*(?:\\d+\\s*[:：]\\s*)?\\d+(?:\\s*[–\\-—]\\s*\\d+)?)*)` +
    `|` +
    `(\\d+)(?=\\s*\\))` +
    `)\\)?(?![\\d:：A-Za-z])`,
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
    (full, bookName: string, chapterNum: string | undefined, verseSpec: string | undefined, chapterOnly: string | undefined) => {
      const bookId = TOKEN_TO_ID.get(bookName.trim());
      if (!bookId) return full;
      const chapter = Number(chapterOnly || chapterNum);
      if (!Number.isInteger(chapter) || chapter < 1) return full;
      const verse = verseSpec ? parseFirstVerse(verseSpec) : undefined;
      const path = askbibleReadPath({ bookId, chapter, verse });
      return `[${full}](${path})`;
    },
  );
}

/** Turn inline English scripture refs into markdown links to read chapter pages. */
export function linkifyExploreArticleScriptureRefsEn(markdown: string): string {
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
