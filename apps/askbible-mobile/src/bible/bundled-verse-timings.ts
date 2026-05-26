import type { CuvChapterVerseTiming } from "./cuv-chapter-verse-timings";
import { parseCuvChapterVerseTimingsPayload } from "./cuv-chapter-verse-timings";
import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";

type VerseTimingsBundleFile = {
  "cuv-simp"?: Record<string, unknown>;
  "web-en"?: Record<string, unknown>;
  "teochew-nt"?: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundle = require("../../assets/content/verse-timings-bundle.json") as VerseTimingsBundleFile;

function scopeForTranslation(
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
): keyof VerseTimingsBundleFile {
  if (voiceId === "teochew-nt") return "teochew-nt";
  const id = translationId.trim().toLowerCase();
  if (id === "web-en" || id.startsWith("web")) return "web-en";
  return "cuv-simp";
}

function chapterKey(bookId: string, chapter: number): string {
  return `${String(bookId || "").trim().toUpperCase()}-${chapter}`;
}

export function loadBundledChapterVerseTimings(
  translationId: string,
  voiceId: CuvChapterAudioVoiceId,
  bookId: string,
  chapter: number,
): CuvChapterVerseTiming[] | null {
  const scope = scopeForTranslation(translationId, voiceId);
  const table = bundle[scope];
  if (!table) return null;
  const raw = table[chapterKey(bookId, chapter)];
  return parseCuvChapterVerseTimingsPayload(raw);
}
