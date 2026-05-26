import type { ChapterSegment } from "./types";

type ChapterSegmentsFile = {
  books?: Record<string, Record<string, ChapterSegment[]>>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const chapterSegmentsFile =
  require("../../../../data/bible/open-usfm-chapter-segments.zh.json") as ChapterSegmentsFile;

export function loadBundledChapterSegments(bookId: string, chapter: number): ChapterSegment[] | null {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;
  const rows = chapterSegmentsFile?.books?.[id]?.[String(ch)];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows;
}
