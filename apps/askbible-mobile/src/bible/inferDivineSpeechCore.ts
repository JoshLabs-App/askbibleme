/**
 * 与仓库根目录 `lib/bible/infer-divine-speech-spans.ts` 保持同步。
 * 试点：自动推断「神 / 主耶稣直接发言」在节内的字符区间。
 */

import { DIVINE_SPEECH_PILOT_CHAPTERS, type DivineSpeechInferContext, type DivineSpeechSpan } from "./divineSpeechTypes";
import { exo20Verses5And6FullVerseDivine, jhn3JesusContinuationFullVerse } from "./divineSpeechQuoteParsing";
import { enSpansFromSpeechTriggers, zhSpansFromSpeechTriggers } from "./divineSpeechTriggers";
import { heuristicLocale, mergeDivineSpeechSpans } from "./divineSpeechSpanUtils";
import { enAllQuotedSpans, zhAllQuotedSpans } from "./divineSpeechQuoteParsingCore";

export function isDivineSpeechPilotChapter(bookId: string, chapter: number): boolean {
  return DIVINE_SPEECH_PILOT_CHAPTERS.some((e) => e.bookId === bookId && e.chapter === chapter);
}

export function inferDivineSpeechSpans(text: string, ctx: DivineSpeechInferContext): DivineSpeechSpan[] {
  const loc = heuristicLocale(ctx.translationId);
  if (!loc) return [];
  const spans: DivineSpeechSpan[] = [];
  const exo56 = exo20Verses5And6FullVerseDivine(ctx, text);
  if (exo56) spans.push(exo56);
  const jhn3Cont = jhn3JesusContinuationFullVerse(ctx, text, loc);
  if (jhn3Cont) spans.push(jhn3Cont);
  if (loc === "zh") {
    spans.push(...zhSpansFromSpeechTriggers(text, ctx));
  } else {
    spans.push(...enSpansFromSpeechTriggers(text));
  }
  return mergeDivineSpeechSpans(spans).filter((s) => s.start < s.end && s.end <= text.length);
}

export function inferAllQuotedSpeechSpans(text: string, translationId: string): DivineSpeechSpan[] {
  const loc = heuristicLocale(translationId);
  if (!loc) return [];
  const spans = loc === "zh" ? zhAllQuotedSpans(text) : enAllQuotedSpans(text);
  return mergeDivineSpeechSpans(spans).filter((s) => s.start < s.end && s.end <= text.length);
}
