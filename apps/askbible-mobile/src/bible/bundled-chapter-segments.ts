import type { ChapterSegment } from "./types";

type ChapterSegmentsFile = {
  books?: Record<string, Record<string, ChapterSegment[]>>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const chapterSegmentsFile =
  require("./generated/open-usfm-chapter-segments.zh.json") as ChapterSegmentsFile;
const storyT1ChapterSegmentsFile =
  require("./generated/open-usfm-chapter-segments.story.t1.zh.json") as ChapterSegmentsFile;

export type ChapterSegmentMode = "default" | "t1";

function toStoryTitle(raw: string): string {
  const trimmed = String(raw || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const compact = trimmed
    .split(/[，。；：!?！？]/)[0]
    ?.split(/[（(]/)[0]
    ?.trim();
  if (!compact) return "";
  const isHan = /[\u3400-\u9FFF]/.test(compact);
  if (isHan) {
    const normalized = compact
      .replace(/（.*$/, "")
      .replace(/\s+/g, "")
      .trim();
    if (!normalized) return "";
    if (normalized.endsWith("后裔")) return `${normalized.slice(0, -2)}后裔继续繁衍`;
    if (normalized.endsWith("家谱")) return `${normalized.slice(0, -2)}家谱继续展开`;
    if (normalized.endsWith("之约")) return `神立下${normalized}`;
    if (normalized.endsWith("试探")) return `${normalized.slice(0, -2)}前来试探`;
    if (normalized.endsWith("受罚")) return `${normalized.slice(0, -2)}受到刑罚`;
    if (normalized.endsWith("蒙恩")) return `${normalized.slice(0, -2)}在神前蒙恩`;
    if (normalized.length <= 12) return normalized;
    return normalized.slice(0, 12);
  }
  const words = compact.split(" ").filter(Boolean);
  return words.slice(0, 5).join(" ");
}

function toStorySegments(rows: ChapterSegment[]): ChapterSegment[] {
  const chapter = rows[0]?.chapter ?? 1;
  const headingStarts = new Set<number>();
  const out: ChapterSegment[] = [];
  for (const row of rows) {
    if (row.type !== "heading" || !Number.isInteger(row.verseStart) || row.verseStart == null) continue;
    const titleRaw = row.titleZh || row.title || "";
    const storyTitle = toStoryTitle(titleRaw);
    if (!storyTitle) continue;
    headingStarts.add(row.verseStart);
    const titleRawEn = String(row.title || "").trim();
    const storyTitleEn = titleRawEn ? toStoryTitle(titleRawEn) || titleRawEn : "";
    out.push({
      ...row,
      title: storyTitleEn,
      titleZh: storyTitle,
    });
  }
  if (out.length === 0) return rows;
  const paragraphRows = Array.from(headingStarts)
    .sort((a, b) => a - b)
    .map((verseStart, idx) => ({
      id: `story-p-${idx + 1}-${verseStart}`,
      type: "paragraph" as const,
      marker: "p",
      chapter,
      verseStart,
      verseEnd: verseStart,
    }));
  const sorted = [...out, ...paragraphRows].sort((a, b) => {
    const av = a.verseStart ?? 0;
    const bv = b.verseStart ?? 0;
    if (av !== bv) return av - bv;
    if (a.type === b.type) return 0;
    return a.type === "heading" ? -1 : 1;
  });
  return sorted;
}

function mergeStoryWithDefaultSegments(
  defaultRows: ChapterSegment[],
  storyRows: ChapterSegment[],
): ChapterSegment[] {
  const storyHeadings = storyRows
    .filter(
      (row) =>
        row.type === "heading" &&
        Number.isInteger(row.verseStart) &&
        row.verseStart != null &&
        String(row.titleZh || row.title || "").trim().length > 0,
    )
    .map((row, idx) => ({
      id: `story:${row.id || idx}`,
      verseStart: row.verseStart as number,
      titleZh: String(row.titleZh || row.title || "").trim(),
    }));

  if (storyHeadings.length === 0) return defaultRows;

  const byVerse = new Map<number, string[]>();
  for (const row of storyHeadings) {
    const bucket = byVerse.get(row.verseStart) ?? [];
    bucket.push(row.titleZh);
    byVerse.set(row.verseStart, bucket);
  }

  const usedTitles = new Set<string>();
  const merged: ChapterSegment[] = [];
  for (const row of defaultRows) {
    if (row.type === "heading" && Number.isInteger(row.verseStart) && row.verseStart != null) {
      const candidates = byVerse.get(row.verseStart) ?? [];
      const pick = candidates.find((title) => !usedTitles.has(`${row.verseStart}:${title}`));
      if (pick) {
        usedTitles.add(`${row.verseStart}:${pick}`);
        const preservedEn = String(row.title || "").trim();
        merged.push({
          ...row,
          title: preservedEn,
          titleZh: pick,
        });
        continue;
      }
    }
    merged.push(row);
  }

  // If story has headings on verses without default headings, append those headings.
  const defaultHeadingVerse = new Set<number>(
    defaultRows
      .filter((row) => row.type === "heading" && Number.isInteger(row.verseStart) && row.verseStart != null)
      .map((row) => row.verseStart as number),
  );
  let addIndex = 0;
  for (const row of storyHeadings) {
    if (defaultHeadingVerse.has(row.verseStart)) continue;
    merged.push({
      id: `story-extra-h${++addIndex}-${row.verseStart}`,
      type: "heading",
      marker: "s1",
      chapter: defaultRows[0]?.chapter ?? 1,
      verseStart: row.verseStart,
      verseEnd: row.verseStart,
      title: "",
      titleZh: row.titleZh,
    });
  }

  return merged.sort((a, b) => {
    const av = a.verseStart ?? 0;
    const bv = b.verseStart ?? 0;
    if (av !== bv) return av - bv;
    if (a.type === b.type) return 0;
    return a.type === "heading" ? -1 : 1;
  });
}

export function loadBundledChapterSegments(
  bookId: string,
  chapter: number,
  mode: ChapterSegmentMode = "default",
): ChapterSegment[] | null {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;
  const rows = chapterSegmentsFile?.books?.[id]?.[String(ch)];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (mode === "t1") {
    const storyRows = storyT1ChapterSegmentsFile?.books?.[id]?.[String(ch)];
    if (Array.isArray(storyRows) && storyRows.length > 0) {
      return mergeStoryWithDefaultSegments(rows, storyRows);
    }
    return toStorySegments(rows);
  }
  return rows;
}
