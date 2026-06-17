import { resolveChapterSegmentHeadingText } from "../bible/chapter-segment-display";
import type { ChapterSegment } from "../bible/types";
import type { LoadedChapter } from "../bible/types";
import type { AppLocale } from "../i18n/config";

export function buildChapterSegmentMeta(
  chapterSegments: ChapterSegment[] | null,
  readDisplayLocale: AppLocale,
  localeZhText: (text: string) => string,
  preferEnglishSegmentTitles: boolean,
) {
  const headingByVerse = new Map<number, string[]>();
  const paragraphStarts = new Set<number>();
  for (const row of chapterSegments ?? []) {
    if (!Number.isInteger(row.verseStart) || row.verseStart == null) continue;
    if (row.type === "heading") {
      const text = resolveChapterSegmentHeadingText(
        row,
        readDisplayLocale,
        localeZhText,
        preferEnglishSegmentTitles,
      );
      if (text) {
        const bucket = headingByVerse.get(row.verseStart) ?? [];
        bucket.push(text);
        headingByVerse.set(row.verseStart, bucket);
      }
    }
    if (row.type === "paragraph" || row.type === "poetry") {
      paragraphStarts.add(row.verseStart);
    }
  }
  return { headingByVerse, paragraphStarts };
}

export function buildParagraphGroups(
  verses: LoadedChapter["verses"],
  segmentMeta: { headingByVerse: Map<number, string[]>; paragraphStarts: Set<number> },
) {
  const groups: Array<{ verses: typeof verses }> = [];
  let current: typeof verses = [];
  for (let i = 0; i < verses.length; i += 1) {
    const verse = verses[i]!;
    const isStart =
      i === 0 ||
      segmentMeta.paragraphStarts.has(verse.verse) ||
      (segmentMeta.headingByVerse.get(verse.verse)?.length ?? 0) > 0;
    if (isStart && current.length > 0) {
      groups.push({ verses: current });
      current = [];
    }
    current.push(verse);
  }
  if (current.length > 0) groups.push({ verses: current });
  return groups;
}
