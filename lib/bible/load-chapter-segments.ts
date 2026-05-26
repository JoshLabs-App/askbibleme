import fs from "node:fs";
import path from "node:path";
import { SCRIPTURE_BOOK_NAME_EN } from "@/lib/bible/scripture-book-names-en";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export type ChapterSegmentType = "heading" | "paragraph" | "poetry" | "break";

export type ChapterSegment = {
  id: string;
  type: ChapterSegmentType;
  marker: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  title?: string;
  titleZh?: string;
};

type SegmentsDataset = {
  books?: Record<string, Record<string, ChapterSegment[]>>;
};

const SOURCE_BASE_URL =
  "https://raw.githubusercontent.com/openenglishbible/Open-English-Bible/master/source";
const FALLBACK_WEB_SOURCE_BASE_URL =
  "https://raw.githubusercontent.com/seesmof/Bibles-USFM/main/Bibles/WEB%20World%20English%20Bible";

const LOCAL_ZH_SEGMENTS_REL = path.join("data", "bible", "open-usfm-chapter-segments.zh.json");
const LOCAL_SEGMENTS_REL = path.join("data", "bible", "open-usfm-chapter-segments.json");

const BOOK_NAME_OVERRIDES: Record<string, string> = {
  PSA: "Psalms",
};

const usfmByUrlCache = new Map<string, Promise<string | null>>();
const localSegmentsCache = new Map<string, { mtimeMs: number; data: SegmentsDataset | null }>();

function normalizeInlineUsfmText(text: string): string {
  return text
    .replace(/\\f\s+\+[\s\S]*?\\f\*/g, "")
    .replace(/\[us:([^|\]]+)\|cth:[^\]]+\]/g, "$1")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\[a-z0-9*]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chapterSourceCandidates(bookId: string): string[] {
  const meta = scriptureBooks.find((item) => item.bookId === bookId);
  if (!meta) return [];
  const bookNum = String(meta.bookNumber).padStart(2, "0");
  const englishName = BOOK_NAME_OVERRIDES[bookId] ?? SCRIPTURE_BOOK_NAME_EN[bookId];
  if (!englishName) return [];
  const names = Array.from(new Set([englishName]));
  const out: string[] = [];
  for (const name of names) {
    const base = `${bookNum}-${name}`;
    out.push(`${SOURCE_BASE_URL}/${encodeURIComponent(base)}.usfm.db`);
    out.push(`${SOURCE_BASE_URL}/${encodeURIComponent(base)}.usfm`);
  }
  // Fallback mirror: WEB USFM book files (with front matter at index 00).
  const webOrdinal = String(meta.bookNumber + 1).padStart(2, "0");
  out.push(`${FALLBACK_WEB_SOURCE_BASE_URL}/${webOrdinal}-${bookId}engwebp.usfm`);
  return out;
}

function readLocalSegmentsDataset(cwd: string): SegmentsDataset | null {
  const zhPath = path.join(cwd, LOCAL_ZH_SEGMENTS_REL);
  const plainPath = path.join(cwd, LOCAL_SEGMENTS_REL);
  const target = fs.existsSync(zhPath) ? zhPath : plainPath;
  if (!fs.existsSync(target)) return null;
  const st = fs.statSync(target);
  const hit = localSegmentsCache.get(target);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.data;
  try {
    const parsed = JSON.parse(fs.readFileSync(target, "utf8")) as SegmentsDataset;
    const normalized = parsed && typeof parsed === "object" ? parsed : null;
    localSegmentsCache.set(target, { mtimeMs: st.mtimeMs, data: normalized });
    return normalized;
  } catch {
    localSegmentsCache.set(target, { mtimeMs: st.mtimeMs, data: null });
    return null;
  }
}

async function fetchUsfmText(url: string): Promise<string | null> {
  const key = String(url || "").trim();
  if (!key) return null;
  const hit = usfmByUrlCache.get(key);
  if (hit) return hit;
  const task = (async () => {
    try {
      const res = await fetch(key, { next: { revalidate: 60 * 60 * 24 } });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text.includes("\\c ")) return null;
      return text;
    } catch {
      return null;
    }
  })();
  usfmByUrlCache.set(key, task);
  return task;
}

function parseChapterSegmentsFromUsfm(
  usfmText: string,
  bookId: string,
  chapter: number,
  maxVerse: number | null,
): ChapterSegment[] {
  const lines = usfmText.split(/\r?\n/);
  const blocks: ChapterSegment[] = [];
  let blockId = 0;
  let inTargetChapter = false;
  let currentVerse: number | null = null;
  let pendingHeading: ChapterSegment | null = null;
  let currentBlock: ChapterSegment | null = null;

  const closeCurrentBlock = () => {
    if (!currentBlock) return;
    if (currentBlock.verseEnd == null) {
      currentBlock.verseEnd = currentBlock.verseStart;
    }
    blocks.push(currentBlock);
    currentBlock = null;
  };

  const openBlock = (type: ChapterSegmentType, marker: string) => {
    closeCurrentBlock();
    blockId += 1;
    currentBlock = {
      id: `${bookId}-${chapter}-b${blockId}`,
      type,
      marker,
      chapter,
      verseStart: null,
      verseEnd: null,
    };
  };

  const assignHeadingToVerse = (verse: number) => {
    if (!pendingHeading) return;
    pendingHeading.verseStart = verse;
    pendingHeading.verseEnd = verse;
    blocks.push(pendingHeading);
    pendingHeading = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("\\c ")) {
      const ch = Number(line.slice(3).trim());
      if (ch === chapter) {
        inTargetChapter = true;
        continue;
      }
      if (inTargetChapter) break;
      continue;
    }
    if (!inTargetChapter) continue;

    if (line.startsWith("\\s")) {
      closeCurrentBlock();
      const marker = line.match(/^\\(s\d*)/)?.[1] ?? "s";
      const title = normalizeInlineUsfmText(line.replace(/^\\s\d*\s*/, ""));
      blockId += 1;
      pendingHeading = {
        id: `${bookId}-${chapter}-b${blockId}`,
        type: "heading",
        marker,
        chapter,
        verseStart: null,
        verseEnd: null,
        title,
      };
      continue;
    }
    if (line.startsWith("\\p")) {
      openBlock("paragraph", "p");
      continue;
    }
    if (line.startsWith("\\m")) {
      openBlock("paragraph", "m");
      continue;
    }
    if (line.startsWith("\\q")) {
      const marker = line.match(/^\\(q\d*)/)?.[1] ?? "q";
      openBlock("poetry", marker);
      continue;
    }
    if (line.startsWith("\\b")) {
      closeCurrentBlock();
      blockId += 1;
      blocks.push({
        id: `${bookId}-${chapter}-b${blockId}`,
        type: "break",
        marker: "b",
        chapter,
        verseStart: currentVerse,
        verseEnd: currentVerse,
      });
      continue;
    }
    if (line.startsWith("\\v ")) {
      const match = line.match(/^\\v\s+(\d+)\s*(.*)$/);
      if (!match) continue;
      const verse = Number(match[1]);
      if (!Number.isInteger(verse) || verse < 1) continue;
      currentVerse = verse;
      assignHeadingToVerse(verse);
      if (!currentBlock) openBlock("paragraph", "p");
      if (currentBlock) {
        currentBlock.verseStart = currentBlock.verseStart ?? verse;
        currentBlock.verseEnd = verse;
      }
    }
  }

  closeCurrentBlock();

  const filtered = blocks.filter((item) => {
    if (maxVerse == null) return true;
    const start = item.verseStart ?? 1;
    if (start < 1 || start > maxVerse) return false;
    return true;
  });

  if (filtered.length > 0) return filtered;
  return [];
}

export async function loadChapterSegmentsFromOpenUsfm(
  bookId: string,
  chapter: number,
  maxVerse: number | null = null,
): Promise<ChapterSegment[] | null> {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;
  const candidates = chapterSourceCandidates(id);
  for (const url of candidates) {
    const usfm = await fetchUsfmText(url);
    if (!usfm) continue;
    const parsed = parseChapterSegmentsFromUsfm(usfm, id, ch, maxVerse);
    if (parsed.length) return parsed;
  }
  return null;
}

export function loadChapterSegmentsFromLocalDataset(
  cwd: string,
  bookId: string,
  chapter: number,
): ChapterSegment[] | null {
  const id = String(bookId || "").trim().toUpperCase();
  const ch = Number(chapter);
  if (!id || !Number.isInteger(ch) || ch < 1) return null;
  const dataset = readLocalSegmentsDataset(cwd);
  const rows = dataset?.books?.[id]?.[String(ch)];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows;
}
