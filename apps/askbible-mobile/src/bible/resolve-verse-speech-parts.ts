import {
  splitChapterVersesBySpeechHighlights,
  splitTextBySpeechHighlights,
  translationSupportsSpeechHighlight,
} from "./infer-divine-speech-spans";
import type { VerseSpeechPart } from "./verse-annotations";

function hasNonPlainSpeech(parts: VerseSpeechPart[] | null | undefined): boolean {
  return Boolean(parts?.some((p) => p.kind !== "plain"));
}

export function resolveVerseSpeechParts(
  verse: { text: string; speechParts: VerseSpeechPart[] | null },
  ctx: { translationId: string; bookId: string; chapter: number; verse: number },
): VerseSpeechPart[] | null {
  if (!translationSupportsSpeechHighlight(ctx.translationId)) return verse.speechParts;
  const inferred = splitTextBySpeechHighlights(verse.text, ctx);
  if (hasNonPlainSpeech(inferred)) return inferred;
  return verse.speechParts ?? inferred;
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
    const inferredParts = inferred?.[idx] ?? null;
    out.set(v.verse, hasNonPlainSpeech(inferredParts) ? inferredParts : (v.speechParts ?? inferredParts));
  });
  return out;
}
