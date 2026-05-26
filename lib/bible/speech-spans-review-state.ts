import fs from "node:fs";
import path from "node:path";

export const SPEECH_SPANS_REVIEW_STATE_REL_PATH =
  "data/bible/annotations/speech-spans-review-state-v1.json";

export type SpeechReviewChapterStatus = "todo" | "reviewed" | "needs-fix";

export type SpeechSpansReviewState = {
  format: "askbible-speech-review-state-v1";
  updatedAt: string;
  chapterStatus?: Record<string, SpeechReviewChapterStatus>;
  verseOverrides?: Record<string, Record<string, string>>;
};

export type LoadedSpeechSpansReviewState = {
  absolutePath: string;
  chapterStatus: Map<string, SpeechReviewChapterStatus>;
  verseOverrides: Map<string, Map<string, string>>;
};

export function speechSpansReviewStatePath(cwd: string): string {
  return path.join(cwd, SPEECH_SPANS_REVIEW_STATE_REL_PATH);
}

function normalizeChapterStatus(
  raw: Record<string, unknown> | undefined,
): Map<string, SpeechReviewChapterStatus> {
  const out = new Map<string, SpeechReviewChapterStatus>();
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    const k = String(key || "").trim();
    const v = String(value || "").trim() as SpeechReviewChapterStatus;
    if (!k) continue;
    if (v !== "todo" && v !== "reviewed" && v !== "needs-fix") continue;
    out.set(k, v);
  }
  return out;
}

function normalizeVerseOverrides(
  raw: Record<string, unknown> | undefined,
): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  if (!raw) return out;
  for (const [translationId, verses] of Object.entries(raw)) {
    if (!verses || typeof verses !== "object") continue;
    const translationKey = String(translationId || "").trim();
    if (!translationKey) continue;
    const verseMap = new Map<string, string>();
    for (const [verseKey, spans] of Object.entries(verses as Record<string, unknown>)) {
      const k = String(verseKey || "").trim();
      const v = String(spans || "").trim();
      if (!k || !v) continue;
      verseMap.set(k, v);
    }
    if (verseMap.size) out.set(translationKey, verseMap);
  }
  return out;
}

export function loadSpeechSpansReviewState(
  cwd: string,
): LoadedSpeechSpansReviewState | null {
  const p = speechSpansReviewStatePath(cwd);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<SpeechSpansReviewState>;
    if (raw.format !== "askbible-speech-review-state-v1") return null;
    return {
      absolutePath: p,
      chapterStatus: normalizeChapterStatus(raw.chapterStatus as Record<string, unknown> | undefined),
      verseOverrides: normalizeVerseOverrides(raw.verseOverrides as Record<string, unknown> | undefined),
    };
  } catch {
    return null;
  }
}
