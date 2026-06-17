import {
  OPEN_QUOTES,
  QUOTE_PAIRS,
  ZH_CLOSE_QUOTES,
  ZH_QUOTE_PAIRS,
  type DivineSpeechSpan,
} from "./divineSpeechTypes";
import { mergeDivineSpeechSpans } from "./divineSpeechSpanUtils";

export function startsWithKnownOpenQuote(text: string): boolean {
  const s = text.trimStart();
  if (!s) return false;
  return OPEN_QUOTES.has(s[0]!);
}

export function findContinuationCloseIndex(text: string, closeChar: string): number {
  if (!ZH_CLOSE_QUOTES.includes(closeChar as (typeof ZH_CLOSE_QUOTES)[number])) {
    return text.indexOf(closeChar);
  }
  let best = -1;
  for (const c of ZH_CLOSE_QUOTES) {
    const idx = text.indexOf(c);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

export function findLastUnclosedQuote(text: string): { openIndex: number; closeChar: string } | null {
  const stack: Array<{ openIndex: number; closeChar: string }> = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const closeChar = QUOTE_PAIRS.get(ch);
    if (closeChar) {
      stack.push({ openIndex: i, closeChar });
      continue;
    }
    if (!stack.length) continue;
    const top = stack[stack.length - 1]!;
    if (ch === top.closeChar) stack.pop();
  }
  return stack.length ? stack[0]! : null;
}

export function enInnerSpanBalancedAsciiDoubleQuote(text: string, openIdx: number): DivineSpeechSpan | null {
  if (text[openIdx] !== '"') return null;
  let depth = 1;
  let k = openIdx + 1;
  while (k < text.length && depth > 0) {
    const ch = text[k]!;
    if (ch === '"') depth--;
    k++;
  }
  if (depth !== 0) return { start: openIdx + 1, end: text.length };
  return { start: openIdx + 1, end: k - 1 };
}

function collectQuotedInnerSpans(text: string, pairs: ReadonlyMap<string, string>): DivineSpeechSpan[] {
  const stack: Array<{ open: number; close: string }> = [];
  const spans: DivineSpeechSpan[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const close = pairs.get(ch);
    if (close) {
      stack.push({ open: i, close });
      continue;
    }
    if (!stack.length) continue;
    const top = stack[stack.length - 1]!;
    if (ch !== top.close) continue;
    stack.pop();
    const start = top.open + 1;
    const end = i;
    if (start < end) spans.push({ start, end });
  }
  for (const unclosed of stack) {
    const start = unclosed.open + 1;
    if (start < text.length) spans.push({ start, end: text.length });
  }
  return mergeDivineSpeechSpans(spans);
}

export function zhAllQuotedSpans(text: string): DivineSpeechSpan[] {
  return collectQuotedInnerSpans(text, ZH_QUOTE_PAIRS);
}

export function enAllQuotedSpans(text: string): DivineSpeechSpan[] {
  const spans: DivineSpeechSpan[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "\u201c") {
      const end = text.indexOf("\u201d", i + 1);
      spans.push({ start: i + 1, end: end === -1 ? text.length : end });
      if (end !== -1) i = end;
      continue;
    }
    if (c === '"') {
      const inner = enInnerSpanBalancedAsciiDoubleQuote(text, i);
      if (inner) {
        spans.push(inner);
        i = Math.max(i, inner.end - 1);
      }
    }
  }
  return spans;
}
