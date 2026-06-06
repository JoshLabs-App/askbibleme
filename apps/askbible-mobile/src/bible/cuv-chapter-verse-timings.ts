import { loadBundledChapterVerseTimings } from "./bundled-verse-timings";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { translationUsesWebChapterAudio } from "./web-chapter-audio";
import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";

export type CuvChapterVerseTiming = {
  verse: number;
  start: number;
  end: number;
};

export function buildChapterVerseTimingsUrl(
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
  bookId: string,
  chapter: number,
): string {
  return buildChapterVerseTimingsCandidates(translationId, voiceId, bookId, chapter)[0] ?? "";
}

export function buildChapterVerseTimingsCandidates(
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
  bookId: string,
  chapter: number,
): string[] {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return [];
  if (translationUsesWebChapterAudio(translationId)) {
    return [`/verse-timings/web-en/${id}-${chapter}.json`];
  }
  if (voiceId === "teochew-nt") {
    return [`/verse-timings/teochew-nt/${id}-${chapter}.json`];
  }
  return [
    `/verse-timings/cuv-v20/${id}-${chapter}.json`,
    `/verse-timings/${id}-${chapter}.json`,
  ];
}

export function buildCuvChapterVerseTimingsUrl(bookId: string, chapter: number): string {
  return buildChapterVerseTimingsUrl("cuv-simp", "mandarin", bookId, chapter);
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

export function verseNumberAtChapterAudioTime(
  currentSec: number,
  timings: readonly CuvChapterVerseTiming[],
): number | null {
  if (!timings.length || !Number.isFinite(currentSec)) return null;
  let pick: CuvChapterVerseTiming | null = null;
  for (let i = timings.length - 1; i >= 0; i--) {
    if (timings[i]!.start <= currentSec) {
      pick = timings[i]!;
      break;
    }
  }
  if (!pick) return null;
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

export async function fetchChapterVerseTimings(
  baseUrl: string,
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
  bookId: string,
  chapter: number,
): Promise<CuvChapterVerseTiming[] | null> {
  if (isMobileBundledOnly()) {
    return loadBundledChapterVerseTimings(translationId, voiceId, bookId, chapter);
  }

  const paths = buildChapterVerseTimingsCandidates(translationId, voiceId, bookId, chapter);
  if (!paths.length) return null;
  for (const path of paths) {
    const url = toAbsoluteUrl(baseUrl, path);
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data: unknown = await res.json();
      const parsed = parseCuvChapterVerseTimingsPayload(data);
      if (parsed?.length) return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function fetchCuvChapterVerseTimings(
  baseUrl: string,
  bookId: string,
  chapter: number,
): Promise<CuvChapterVerseTiming[] | null> {
  return fetchChapterVerseTimings(baseUrl, "cuv-simp", "mandarin", bookId, chapter);
}
