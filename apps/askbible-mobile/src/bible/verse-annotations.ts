/**
 * 与仓库根目录 `lib/bible/verse-annotations.ts` 保持同步（解码、flags、theme_repeat_count）。
 */
import { verseShowsGoldenThemeMarker } from "./golden-verse-theme-repeat";

import type { SpeechHighlightKind } from "./infer-divine-speech-spans";

export const VERSE_FLAG_GOLDEN = 1;

export {
  MIN_GOLDEN_THEME_REPEAT_COUNT,
  verseShowsGoldenThemeMarker,
} from "./golden-verse-theme-repeat";

export type VerseSpeechPart = { kind: SpeechHighlightKind; text: string };

type StoredSpeechSpanTuple = [number, number, 1 | 2];

/** @deprecated 请用 `theme_repeat_count` 与 `verseShowsGoldenThemeMarker`。 */
export function isGoldenVerseFlag(flags: number): boolean {
  return (flags & VERSE_FLAG_GOLDEN) !== 0;
}

function decodeSpeechSpans(raw: string | null | undefined): StoredSpeechSpanTuple[] {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: StoredSpeechSpanTuple[] = [];
    for (const row of parsed) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const start = Number(row[0]);
      const end = Number(row[1]);
      const code = Number(row[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) continue;
      if (code === 1) out.push([start, end, 1]);
      else if (code === 2) out.push([start, end, 2]);
    }
    return out;
  } catch {
    return [];
  }
}

export function speechPartsFromStoredSpans(
  text: string,
  raw: string | null | undefined,
): VerseSpeechPart[] | null {
  const spans = decodeSpeechSpans(raw);
  if (!spans.length) return null;
  const parts: VerseSpeechPart[] = [];
  let cur = 0;
  for (const [start, end, code] of spans.sort((a, b) => a[0] - b[0])) {
    if (start > cur) parts.push({ kind: "plain", text: text.slice(cur, start) });
    const kind: SpeechHighlightKind = code === 1 ? "divine" : "human";
    parts.push({ kind, text: text.slice(start, end) });
    cur = end;
  }
  if (cur < text.length) parts.push({ kind: "plain", text: text.slice(cur) });
  return parts.length ? parts : null;
}

export function loadedChapterVerseFromRow(row: {
  verse: number;
  text: string;
  speech_spans?: string | null;
  flags?: number | null;
  theme_repeat_count?: number | null;
}): import("./types").LoadedChapterVerse | null {
  const verse = Number(row.verse);
  const text = String(row.text ?? "").trim();
  if (!Number.isInteger(verse) || verse < 1 || !text) return null;
  const themeRepeatCount = Math.max(0, Number(row.theme_repeat_count ?? 0));
  return {
    verse,
    text,
    speechParts: speechPartsFromStoredSpans(text, row.speech_spans),
    themeRepeatCount,
    isGolden: verseShowsGoldenThemeMarker(themeRepeatCount),
  };
}
