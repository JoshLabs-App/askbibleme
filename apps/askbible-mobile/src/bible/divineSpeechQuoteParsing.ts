import type { DivineSpeechInferContext, DivineSpeechSpan } from "./divineSpeechTypes";
import { skipChineseColon, skipWsOptionalCommaWs } from "./divineSpeechSpanUtils";
import { ZH_QUOTE_PAIRS } from "./divineSpeechTypes";
import { enInnerSpanBalancedAsciiDoubleQuote } from "./divineSpeechQuoteParsingCore";

function zhSpanFromOpenQuote(text: string, openIdx: number): DivineSpeechSpan | null {
  if (openIdx < 0 || openIdx >= text.length) return null;
  const o = text[openIdx]!;
  const close = ZH_QUOTE_PAIRS.get(o);
  if (!close) return null;
  const innerStart = openIdx + 1;
  const closeIdx = text.indexOf(close, innerStart);
  if (closeIdx === -1) return { start: innerStart, end: text.length };
  return { start: innerStart, end: closeIdx };
}

export function zhSpanAfterSpeechCue(text: string, cueEnd: number): DivineSpeechSpan | null {
  let j = skipWsOptionalCommaWs(text, cueEnd);
  j = skipChineseColon(text, j);
  if (j >= text.length) return null;
  const c = text[j]!;
  if (ZH_QUOTE_PAIRS.has(c)) return zhSpanFromOpenQuote(text, j);
  return { start: j, end: text.length };
}

export function enSpanAfterSpeechCue(text: string, cueEnd: number): DivineSpeechSpan | null {
  let j = skipWsOptionalCommaWs(text, cueEnd);
  if (j < text.length && (text[j] === ":" || text[j] === ";")) {
    j++;
    while (j < text.length && /\s/.test(text[j]!)) j++;
  }
  if (j >= text.length) return null;
  const c = text[j]!;
  if (c === "\u201c") {
    const end = text.indexOf("\u201d", j + 1);
    if (end === -1) return { start: j + 1, end: text.length };
    return { start: j + 1, end: end };
  }
  if (c === '"') {
    const inner = enInnerSpanBalancedAsciiDoubleQuote(text, j);
    if (inner) return inner;
    return { start: j + 1, end: text.length };
  }
  return { start: j, end: text.length };
}

export function exo20Verses5And6FullVerseDivine(ctx: DivineSpeechInferContext, text: string): DivineSpeechSpan | null {
  if (ctx.bookId !== "EXO" || ctx.chapter !== 20) return null;
  if (ctx.verse !== 5 && ctx.verse !== 6) return null;
  if (!text.trim()) return null;
  return { start: 0, end: text.length };
}

export function jhn3JesusContinuationFullVerse(
  ctx: DivineSpeechInferContext,
  text: string,
  loc: "zh" | "en",
): DivineSpeechSpan | null {
  if (ctx.bookId !== "JHN" || ctx.chapter !== 3) return null;
  const verses =
    loc === "zh"
      ? new Set([6, 7, 8, 11, 12, 13, 14, 15, 32, 33, 34, 35, 36])
      : new Set([6, 7, 8, 11, 12, 13, 14, 15]);
  if (!verses.has(ctx.verse)) return null;
  if (!text.trim()) return null;
  return { start: 0, end: text.length };
}
