import type { VerseRef } from "@/lib/bible/verse-ref";

export function scriptureXrefSnippetKey(ref: VerseRef): string {
  const end = ref.verseEnd ?? ref.verseStart;
  return `${ref.bookId}:${ref.chapter}:${ref.verseStart}:${end}`;
}

/** 从一章经文中拼接连续经节正文（xref 列表展示用）。 */
export function joinVerseRangeText(
  verses: { verse: number; text: string }[],
  verseStart: number,
  verseEnd: number,
): string {
  const end = verseEnd >= verseStart ? verseEnd : verseStart;
  return verses
    .filter((v) => v.verse >= verseStart && v.verse <= end)
    .map((v) => v.text.trim())
    .filter(Boolean)
    .join(" ");
}
