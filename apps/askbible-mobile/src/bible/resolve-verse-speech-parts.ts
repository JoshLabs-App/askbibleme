import {
  splitChapterVersesBySpeechHighlights,
  splitTextBySpeechHighlights,
  translationSupportsSpeechHighlight,
} from "./infer-divine-speech-spans";
import type { VerseSpeechPart } from "./verse-annotations";

export function resolveVerseSpeechParts(
  verse: { text: string; speechParts: VerseSpeechPart[] | null },
  ctx: { translationId: string; bookId: string; chapter: number; verse: number },
): VerseSpeechPart[] | null {
  if (verse.speechParts?.length) return verse.speechParts;
  if (!translationSupportsSpeechHighlight(ctx.translationId)) return null;
  return splitTextBySpeechHighlights(verse.text, ctx);
}

export function resolveChapterVerseSpeechParts(
  verses: readonly { verse: number; text: string; speechParts: VerseSpeechPart[] | null }[],
  baseCtx: { translationId: string; bookId: string; chapter: number },
): Map<number, VerseSpeechPart[] | null> {
  const out = new Map<number, VerseSpeechPart[] | null>();
  if (!verses.length) return out;

  const inferred = translationSupportsSpeechHighlight(baseCtx.translationId)
    ? splitChapterVersesBySpeechHighlights(
        verses.map((v) => ({ verse: v.verse, text: v.text })),
        baseCtx,
      )
    : null;

  verses.forEach((v, idx) => {
    if (v.speechParts?.length) {
      out.set(v.verse, v.speechParts);
      return;
    }
    out.set(v.verse, inferred?.[idx] ?? null);
  });
  return out;
}
