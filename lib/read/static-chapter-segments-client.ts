"use client";

import {
  resolveBundledChapterSegments,
  type ChapterSegmentMode,
} from "@/lib/bible/chapter-segments-resolve";
import type { ChapterSegment } from "@/lib/bible/load-chapter-segments";

type ChapterSegmentsFile = {
  books?: Record<string, Record<string, ChapterSegment[]>>;
};

const DEFAULT_URL = "/read/open-usfm-chapter-segments.zh.json";
const STORY_T1_URL = "/read/open-usfm-chapter-segments.story.t1.zh.json";

let defaultPromise: Promise<ChapterSegmentsFile | null> | null = null;
let storyPromise: Promise<ChapterSegmentsFile | null> | null = null;

async function fetchDataset(url: string): Promise<ChapterSegmentsFile | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const parsed = (await res.json()) as ChapterSegmentsFile;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function loadDefaultDataset(): Promise<ChapterSegmentsFile | null> {
  if (!defaultPromise) defaultPromise = fetchDataset(DEFAULT_URL);
  return defaultPromise;
}

function loadStoryDataset(): Promise<ChapterSegmentsFile | null> {
  if (!storyPromise) storyPromise = fetchDataset(STORY_T1_URL);
  return storyPromise;
}

/** 网页：从 public/read 静态 JSON 取章节分段（不经 /api/read/chapter-segments）。 */
export async function fetchStaticChapterSegments(
  bookId: string,
  chapter: number,
  mode: ChapterSegmentMode = "default",
): Promise<ChapterSegment[] | null> {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;

  const zhDataset = await loadDefaultDataset();
  const rows = zhDataset?.books?.[id]?.[String(ch)];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (mode === "default") return rows;

  const storyDataset = await loadStoryDataset();
  const storyRows = storyDataset?.books?.[id]?.[String(ch)];
  return resolveBundledChapterSegments(
    rows,
    Array.isArray(storyRows) ? storyRows : null,
    mode,
  );
}
