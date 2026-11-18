import fs from "node:fs";
import path from "node:path";
import { readPublicAssetJson } from "@/lib/read-public-asset";
import {
  resolveBundledChapterSegments,
  type ChapterSegmentMode,
} from "@/lib/bible/chapter-segments-resolve";
import type { ChapterSegment } from "@/lib/bible/load-chapter-segments";

export type { ChapterSegmentMode } from "@/lib/bible/chapter-segments-resolve";
export { resolveBundledChapterSegments } from "@/lib/bible/chapter-segments-resolve";

type ChapterSegmentsFile = {
  books?: Record<string, Record<string, ChapterSegment[]>>;
};

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

type StaticBookSegmentsFile = {
  chapters?: Record<string, ChapterSegment[]>;
  storyT1?: Record<string, ChapterSegment[]>;
};

const staticBookCache = new Map<string, StaticBookSegmentsFile | null>();

/** 与 mobile `loadBundledChapterSegments` 同源：默认 USFM 分段 + 可选 T1 故事标题。 */
export async function loadBundledChapterSegments(
  cwd: string,
  bookId: string,
  chapter: number,
  mode: ChapterSegmentMode = "default",
): Promise<ChapterSegment[] | null> {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;

  let bookData = staticBookCache.get(id);
  if (bookData === undefined) {
    bookData = await readPublicAssetJson<StaticBookSegmentsFile>(
      `/data/chapter-segments/${id}.json`,
      cwd,
    );
    if (bookData) staticBookCache.set(id, bookData);
  }
  if (bookData) {
    const rows = bookData.chapters?.[String(ch)];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    if (mode === "default") return rows;
    const storyRows = bookData.storyT1?.[String(ch)] ?? null;
    return resolveBundledChapterSegments(rows, storyRows, mode);
  }

  const zhDataset = readSegmentsDataset(cwd, LOCAL_ZH_SEGMENTS_REL);
  const rows = zhDataset?.books?.[id]?.[String(ch)];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (mode === "default") return rows;
  const storyDataset = readSegmentsDataset(cwd, LOCAL_STORY_T1_SEGMENTS_REL);
  const storyRows = storyDataset?.books?.[id]?.[String(ch)] ?? null;
  return resolveBundledChapterSegments(rows, storyRows, mode);
}
