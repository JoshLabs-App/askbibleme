import { askbibleReadPath } from "@/lib/bible/parse-askbible-read-link";
import {
  parseFirstVerseFromSpec,
  parseZhArticleScriptureRefMatch,
  ZH_ARTICLE_SCRIPTURE_REF_RE,
} from "@/lib/explore/article-scripture-ref-zh";

function linkifySegment(text: string): string {
  return text.replace(
    ZH_ARTICLE_SCRIPTURE_REF_RE,
    (
      full,
      guillemetBook: string | undefined,
      plainBook: string | undefined,
      chapterNum: string | undefined,
      verseSpec: string | undefined,
      chapterOnly: string | undefined,
    ) => {
      const parsed = parseZhArticleScriptureRefMatch(
        full,
        guillemetBook,
        plainBook,
        chapterNum,
        verseSpec,
        chapterOnly,
      );
      if (!parsed) return full;

      const verse = verseSpec ? parseFirstVerseFromSpec(verseSpec) : undefined;
      const path = askbibleReadPath({ bookId: parsed.bookId, chapter: parsed.chapter, verse });
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
