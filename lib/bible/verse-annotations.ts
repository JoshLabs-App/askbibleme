import type { SpeechHighlightKind } from "@/lib/bible/infer-divine-speech-spans";
import { splitChapterVersesBySpeechHighlights } from "@/lib/bible/infer-divine-speech-spans";
import {
  MIN_GOLDEN_THEME_REPEAT_COUNT,
  verseShowsGoldenThemeMarker,
} from "@/lib/bible/golden-verse-theme-markers";

/** SQLite `verse.flags` 保留扩展；金句展示见 `theme_repeat_count` + `MIN_GOLDEN_THEME_REPEAT_COUNT`。 */
export const VERSE_FLAG_GOLDEN = 1;

export { MIN_GOLDEN_THEME_REPEAT_COUNT, verseShowsGoldenThemeMarker };

export type VerseSpeechSpanKind = "divine" | "human";

/** 存库 JSON：`[[start,end,kindCode],…]`，kindCode 1=神言 2=人话 */
export type StoredSpeechSpanTuple = [number, number, 1 | 2];

export type VerseSpeechPart = { kind: SpeechHighlightKind; text: string };

export function verseAnnotationKey(bookId: string, chapter: number, verse: number): string {
  return `${String(bookId).trim().toUpperCase()}:${chapter}:${verse}`;
}

/** @deprecated 请用 `theme_repeat_count` 与 `verseShowsGoldenThemeMarker`。 */
export function isGoldenVerseFlag(flags: number): boolean {
  return (flags & VERSE_FLAG_GOLDEN) !== 0;
}

export function encodeSpeechSpans(
  parts: readonly VerseSpeechPart[],
): string {
  const tuples: StoredSpeechSpanTuple[] = [];
  let offset = 0;
  for (const p of parts) {
    const len = p.text.length;
    if (p.kind === "divine") tuples.push([offset, offset + len, 1]);
    else if (p.kind === "human") tuples.push([offset, offset + len, 2]);
    offset += len;
  }
  return tuples.length ? JSON.stringify(tuples) : "";
}

export function decodeSpeechSpans(raw: string | null | undefined): StoredSpeechSpanTuple[] {
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

export function buildChapterVerseAnnotations(input: {
  translationId: string;
  bookId: string;
  chapter: number;
  verses: readonly { verse: number; text: string }[];
  themeRepeatCounts: ReadonlyMap<string, number>;
  speechHighlight: boolean;
  speechSpansByVerseKey?: ReadonlyMap<string, string>;
}): Map<number, { speechSpans: string; flags: number; themeRepeatCount: number }> {
  const {
    translationId,
    bookId,
    chapter,
    verses,
    themeRepeatCounts,
    speechHighlight,
    speechSpansByVerseKey,
  } = input;
  const out = new Map<number, { speechSpans: string; flags: number; themeRepeatCount: number }>();

  const speechByVerse = speechHighlight
    ? splitChapterVersesBySpeechHighlights(verses, { translationId, bookId, chapter })
    : null;

  verses.forEach((v, i) => {
    const key = verseAnnotationKey(bookId, chapter, v.verse);
    const themeRepeatCount = themeRepeatCounts.get(key) ?? 0;
    let flags = 0;
    if (verseShowsGoldenThemeMarker(themeRepeatCount)) {
      flags |= VERSE_FLAG_GOLDEN;
    }
    const parts = speechByVerse?.[i] ?? null;
    const speechSpansFromSnapshot = speechSpansByVerseKey?.get(key) ?? null;
    const speechSpans = speechSpansFromSnapshot ?? (parts ? encodeSpeechSpans(parts) : "");
    out.set(v.verse, { speechSpans, flags, themeRepeatCount });
  });

  return out;
}
