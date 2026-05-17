/**
 * 和合本整章朗读逐节时间轴（来自 AskBible `public/verse-timings/{BOOK}-{章}.json`，Whisper/stable-ts 对齐）。
 */

export type CuvChapterVerseTiming = {
  verse: number;
  start: number;
  end: number;
};

export function buildCuvChapterVerseTimingsUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `/verse-timings/${id}-${chapter}.json`;
}

export function parseCuvChapterVerseTimingsPayload(data: unknown): CuvChapterVerseTiming[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const out: CuvChapterVerseTiming[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") return null;
    const verse = Number((row as CuvChapterVerseTiming).verse);
    const start = Number((row as CuvChapterVerseTiming).start);
    const end = Number((row as CuvChapterVerseTiming).end);
    if (!Number.isFinite(verse) || verse < 1 || !Number.isFinite(start) || !Number.isFinite(end)) {
      return null;
    }
    out.push({ verse, start, end });
  }
  out.sort((a, b) => a.verse - b.verse);
  return out;
}

/** 与 AskBible reader `timeupdate` 一致：取 start ≤ t 的最后一节。 */
export function verseNumberAtChapterAudioTime(
  currentSec: number,
  timings: readonly CuvChapterVerseTiming[],
): number | null {
  if (!timings.length || !Number.isFinite(currentSec)) return null;
  let pick = timings[0]!;
  for (let i = timings.length - 1; i >= 0; i--) {
    if (timings[i]!.start <= currentSec) {
      pick = timings[i]!;
      break;
    }
  }
  const n = Number(pick.verse);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function verseIndexForVerseNumber(
  verses: readonly { verse: number }[],
  verseNumber: number,
): number | null {
  const idx = verses.findIndex((v) => v.verse === verseNumber);
  return idx >= 0 ? idx : null;
}

export async function fetchCuvChapterVerseTimings(
  bookId: string,
  chapter: number,
): Promise<CuvChapterVerseTiming[] | null> {
  const url = buildCuvChapterVerseTimingsUrl(bookId, chapter);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return parseCuvChapterVerseTimingsPayload(data);
  } catch {
    return null;
  }
}
