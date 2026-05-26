import {
  splitTextBySpeechHighlights,
  translationSupportsSpeechHighlight,
  type SpeechHighlightKind,
} from "@/lib/bible/infer-divine-speech-spans";
import type { VerseSpeechPart } from "@/lib/bible/verse-annotations";

/** 优先用 SQLite 预标注；旧库或无标注时回退运行时推断。 */
export function resolveVerseSpeechParts(
  verse: { text: string; speechParts: VerseSpeechPart[] | null },
  ctx: { translationId: string; bookId: string; chapter: number; verse: number },
): VerseSpeechPart[] | null {
  if (verse.speechParts?.length) return verse.speechParts;
  if (!translationSupportsSpeechHighlight(ctx.translationId)) return null;
  return splitTextBySpeechHighlights(verse.text, ctx);
}

export type { SpeechHighlightKind };
