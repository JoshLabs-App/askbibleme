import { scriptureBooks } from "../bible/scripture-books";

type BookToken = { token: string; bookId: string };

const BOOK_ABBR_TO_ID: Record<string, string> = {
  创: "GEN",
  出: "EXO",
  民: "NUM",
  申: "DEU",
  书: "JOS",
  撒上: "1SA",
  撒下: "2SA",
  王上: "1KI",
  王下: "2KI",
  代上: "1CH",
  代下: "2CH",
  诗: "PSA",
  箴: "PRO",
  传: "ECC",
  赛: "ISA",
  耶: "JER",
  亚: "ZEC",
  但: "DAN",
  太: "MAT",
  可: "MRK",
  路: "LUK",
  约: "JHN",
  徒: "ACT",
  罗: "ROM",
  林前: "1CO",
  林后: "2CO",
  加: "GAL",
  弗: "EPH",
  腓: "PHP",
  西: "COL",
  帖前: "1TH",
  帖后: "2TH",
  提前: "1TI",
  提后: "2TI",
  多: "TIT",
  来: "HEB",
  雅: "JAS",
  彼前: "1PE",
  彼后: "2PE",
  约壹: "1JN",
  约叁: "3JN",
  犹: "JUD",
  启: "REV",
  弥: "MIC",
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBookTokens(): BookToken[] {
  const entries = new Map<string, string>();
  for (const book of scriptureBooks) {
    entries.set(book.bookName, book.bookId);
  }
  for (const [token, bookId] of Object.entries(BOOK_ABBR_TO_ID)) {
    if (!entries.has(token)) entries.set(token, bookId);
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

function readPath(bookId: string, chapter: number, verse?: number): string {
  const base = `/read/${bookId}/${chapter}`;
  return verse != null ? `${base}?verse=${verse}` : base;
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
      return `[${full}](${readPath(bookId, chapter, verse)})`;
    },
  );
}

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
