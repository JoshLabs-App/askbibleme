/**
 * 整章朗读逐节时间轴（Whisper/stable-ts 对齐）。
 * - 普通话：`/verse-timings/{BOOK}-{章}.json`（自 AskBible 同步）
 * - 潮州语新约：`/verse-timings/teochew-nt/{BOOK}-{章}.json`
 * - WEBP：官方 OGG 尚无匹配的逐节时间轴，播放时不套用旧 WEB 时间轴
 * - KJV：`/verse-timings/kjv/{BOOK}-{章}.json`（与 AudioTreasure KJV 对齐）
 */

import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { teochewNtVoiceActive } from "@/lib/bible/teochew-nt-audio";
import {
  translationUsesKjvChapterAudio,
  translationUsesWebChapterAudio,
} from "@/lib/bible/web-chapter-audio";
import { translationUsesYouVersionChapterAudio } from "@/lib/bible/youversion-chapter-audio";

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
  if (String(translationId || "").trim().toLowerCase() === "web-en") return [];
  if (translationUsesKjvChapterAudio(translationId)) {
    return [`/verse-timings/kjv/${id}-${chapter}.json`];
  }
  if (translationUsesWebChapterAudio(translationId)) {
    return [`/verse-timings/web-en/${id}-${chapter}.json`];
  }
  if (translationUsesYouVersionChapterAudio(translationId)) {
    return [`/verse-timings/${String(translationId || "").trim().toLowerCase()}/${id}-${chapter}.json`];
  }
  if (teochewNtVoiceActive(voiceId)) {
    return [`/verse-timings/teochew-nt/${id}-${chapter}.json`];
  }
  return [
    `/verse-timings/cuv-v20/${id}-${chapter}.json`,
    `/verse-timings/${id}-${chapter}.json`,
  ];
}

/** @deprecated use buildChapterVerseTimingsUrl(translationId, voiceId, …) */
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

export async function fetchChapterVerseTimings(
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
  bookId: string,
  chapter: number,
): Promise<CuvChapterVerseTiming[] | null> {
  const urls = buildChapterVerseTimingsCandidates(translationId, voiceId, bookId, chapter);
  if (!urls.length) return null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
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
  bookId: string,
  chapter: number,
): Promise<CuvChapterVerseTiming[] | null> {
  return fetchChapterVerseTimings("cuv-simp", "mandarin", bookId, chapter);
}
