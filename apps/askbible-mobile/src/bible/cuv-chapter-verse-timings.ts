import { loadBundledChapterVerseTimings } from "./bundled-verse-timings";
import { isMobileScriptureReadLocalOnly } from "../config/mobileBundledOnly";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { translationUsesWebChapterAudio } from "./web-chapter-audio";
import { teochewNtVoiceActive } from "./teochew-nt-audio";
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
  // 仅 cuv-v20（与 FHL 闫大卫音频对齐）；旧版根目录 JSON 时间轴已过时，勿再回落。
  return [`/verse-timings/cuv-v20/${id}-${chapter}.json`];
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
  for (let i = 0; i < timings.length; i++) {
    const row = timings[i]!;
    const nextStart = timings[i + 1]?.start;
    const upper =
      nextStart != null && Number.isFinite(nextStart)
        ? nextStart
        : Number.isFinite(row.end) && row.end > row.start
          ? row.end
          : Infinity;
    if (currentSec >= row.start && currentSec < upper) {
      const n = Number(row.verse);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  const last = timings[timings.length - 1]!;
  if (currentSec >= last.start) {
    const n = Number(last.verse);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function verseIndexForVerseNumber(
  verses: readonly { verse: number }[],
  verseNumber: number,
): number | null {
  const idx = verses.findIndex((v) => v.verse === verseNumber);
  return idx >= 0 ? idx : null;
}

/** 节朗读时间轴与字数估算应对齐的译本（繁体屏显仍用 cuv-simp 对齐 FHL 普通话）。 */
export function chapterAudioVerseSyncTranslationId(
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
): string {
  if (translationUsesWebChapterAudio(translationId)) return translationId.trim();
  if (teochewNtVoiceActive(voiceId)) return "cuv-simp";
  const id = translationId.trim().toLowerCase();
  if (id.startsWith("cuv")) return "cuv-simp";
  return translationId.trim();
}

export async function fetchChapterVerseTimings(
  baseUrl: string,
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
  bookId: string,
  chapter: number,
): Promise<CuvChapterVerseTiming[] | null> {
  const syncTranslationId = chapterAudioVerseSyncTranslationId(translationId, voiceId);
  const bundled = loadBundledChapterVerseTimings(syncTranslationId, voiceId, bookId, chapter);
  if (bundled?.length) return bundled;

  if (isMobileScriptureReadLocalOnly()) return null;

  const paths = buildChapterVerseTimingsCandidates(syncTranslationId, voiceId, bookId, chapter);
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
  return loadBundledChapterVerseTimings(syncTranslationId, voiceId, bookId, chapter);
}

export async function fetchCuvChapterVerseTimings(
  baseUrl: string,
  bookId: string,
  chapter: number,
): Promise<CuvChapterVerseTiming[] | null> {
  return fetchChapterVerseTimings(baseUrl, "cuv-simp", "mandarin", bookId, chapter);
}
