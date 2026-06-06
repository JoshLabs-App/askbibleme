import fs from "node:fs";
import path from "node:path";
import type { ChapterSegment } from "@/lib/bible/load-chapter-segments";

type ChapterSegmentsFile = {
  books?: Record<string, Record<string, ChapterSegment[]>>;
};

export type ChapterSegmentMode = "default" | "t1";

const LOCAL_ZH_SEGMENTS_REL = path.join("data", "bible", "open-usfm-chapter-segments.zh.json");
const LOCAL_STORY_T1_SEGMENTS_REL = path.join("data", "bible", "open-usfm-chapter-segments.story.t1.zh.json");

const datasetCache = new Map<string, { mtimeMs: number; data: ChapterSegmentsFile | null }>();

function readSegmentsDataset(cwd: string, relPath: string): ChapterSegmentsFile | null {
  const filePath = path.join(cwd, relPath);
  if (!fs.existsSync(filePath)) return null;
  const st = fs.statSync(filePath);
  const hit = datasetCache.get(filePath);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.data;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ChapterSegmentsFile;
    const data = parsed && typeof parsed === "object" ? parsed : null;
    datasetCache.set(filePath, { mtimeMs: st.mtimeMs, data });
    return data;
  } catch {
    datasetCache.set(filePath, { mtimeMs: st.mtimeMs, data: null });
    return null;
  }
}

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
    out.push({
      ...row,
      title: storyTitle,
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
  return [...out, ...paragraphRows].sort((a, b) => {
    const av = a.verseStart ?? 0;
    const bv = b.verseStart ?? 0;
    if (av !== bv) return av - bv;
    if (a.type === b.type) return 0;
    return a.type === "heading" ? -1 : 1;
  });
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
      title: String(row.titleZh || row.title || "").trim(),
    }));

  if (storyHeadings.length === 0) return defaultRows;

  const byVerse = new Map<number, string[]>();
  for (const row of storyHeadings) {
    const bucket = byVerse.get(row.verseStart) ?? [];
    bucket.push(row.title);
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
        merged.push({
          ...row,
          title: pick,
          titleZh: pick,
        });
        continue;
      }
    }
    merged.push(row);
  }

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
      title: row.title,
      titleZh: row.title,
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

export function resolveBundledChapterSegments(
  defaultRows: ChapterSegment[],
  storyT1Rows: ChapterSegment[] | null,
  mode: ChapterSegmentMode,
): ChapterSegment[] {
  if (mode !== "t1") return defaultRows;
  if (storyT1Rows?.length) return mergeStoryWithDefaultSegments(defaultRows, storyT1Rows);
  return toStorySegments(defaultRows);
}

/** 与 mobile `loadBundledChapterSegments` 同源：默认 USFM 分段 + 可选 T1 故事标题。 */
export function loadBundledChapterSegments(
  cwd: string,
  bookId: string,
  chapter: number,
  mode: ChapterSegmentMode = "default",
): ChapterSegment[] | null {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;
  const zhDataset = readSegmentsDataset(cwd, LOCAL_ZH_SEGMENTS_REL);
  const rows = zhDataset?.books?.[id]?.[String(ch)];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (mode === "default") return rows;
  const storyDataset = readSegmentsDataset(cwd, LOCAL_STORY_T1_SEGMENTS_REL);
  const storyRows = storyDataset?.books?.[id]?.[String(ch)] ?? null;
  return resolveBundledChapterSegments(rows, storyRows, mode);
}
