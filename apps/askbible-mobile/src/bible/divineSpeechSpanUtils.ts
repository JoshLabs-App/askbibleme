import type { DivineSpeechSpan, SpeechHighlightKind } from "./divineSpeechTypes";

export function heuristicLocale(translationId: string): "zh" | "en" | null {
  const id = String(translationId || "").toLowerCase().trim();
  if (id === "cuv-simp" || id === "cuv-trad" || id.includes("cuv")) return "zh";
  if (id === "web-en" || id === "bbe-en") return "en";
  return null;
}

export function mergeDivineSpeechSpans(spans: DivineSpeechSpan[]): DivineSpeechSpan[] {
  if (!spans.length) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: DivineSpeechSpan[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ ...cur });
  }
  return out;
}

export function subtractSpans(from: readonly DivineSpeechSpan[], remove: readonly DivineSpeechSpan[]): DivineSpeechSpan[] {
  const mergedRemove = mergeDivineSpeechSpans([...remove]);
  let parts = mergeDivineSpeechSpans([...from]);
  for (const r of mergedRemove) {
    const next: DivineSpeechSpan[] = [];
    for (const f of parts) {
      if (f.end <= r.start || f.start >= r.end) {
        next.push(f);
        continue;
      }
      if (f.start < r.start) next.push({ start: f.start, end: r.start });
      if (f.end > r.end) next.push({ start: r.end, end: f.end });
    }
    parts = mergeDivineSpeechSpans(next);
  }
  return parts;
}

export function intersectSpans(a: readonly DivineSpeechSpan[], b: readonly DivineSpeechSpan[]): DivineSpeechSpan[] {
  const aa = mergeDivineSpeechSpans([...a]);
  const bb = mergeDivineSpeechSpans([...b]);
  const out: DivineSpeechSpan[] = [];
  let i = 0;
  let j = 0;
  while (i < aa.length && j < bb.length) {
    const x = aa[i]!;
    const y = bb[j]!;
    const start = Math.max(x.start, y.start);
    const end = Math.min(x.end, y.end);
    if (start < end) out.push({ start, end });
    if (x.end < y.end) i++;
    else j++;
  }
  return mergeDivineSpeechSpans(out);
}

export function coalesceSpeechKinds(
  text: string,
  kinds: SpeechHighlightKind[],
): Array<{ kind: SpeechHighlightKind; text: string }> {
  const parts: Array<{ kind: SpeechHighlightKind; text: string }> = [];
  let start = 0;
  let cur = kinds[0] ?? "plain";
  for (let i = 1; i <= text.length; i++) {
    const k = i < text.length ? kinds[i]! : null;
    if (k !== cur) {
      parts.push({ kind: cur, text: text.slice(start, i) });
      start = i;
      cur = k ?? "plain";
    }
  }
  return parts.length ? parts : [{ kind: "plain", text }];
}

export function skipWsOptionalCommaWs(text: string, start: number): number {
  let j = start;
  while (j < text.length && /\s/.test(text[j]!)) j++;
  if (j < text.length && text[j] === ",") {
    j++;
    while (j < text.length && /\s/.test(text[j]!)) j++;
  }
  while (j < text.length && /[，、]/.test(text[j]!)) j++;
  while (j < text.length && /\s/.test(text[j]!)) j++;
  return j;
}

export function skipChineseColon(text: string, start: number): number {
  let j = start;
  if (j < text.length && (text[j] === "：" || text[j] === ":")) {
    j++;
    while (j < text.length && /\s/.test(text[j]!)) j++;
  }
  return j;
}

export function splitTextByDivineSpeechSpans(
  text: string,
  spans: readonly DivineSpeechSpan[],
): Array<{ divine: boolean; text: string }> {
  const merged = mergeDivineSpeechSpans([...spans]).filter((s) => s.start < s.end && s.end <= text.length);
  if (!merged.length) return [{ divine: false, text }];
  const parts: Array<{ divine: boolean; text: string }> = [];
  let cur = 0;
  for (const sp of merged) {
    if (sp.start > cur) parts.push({ divine: false, text: text.slice(cur, sp.start) });
    parts.push({ divine: true, text: text.slice(sp.start, sp.end) });
    cur = sp.end;
  }
  if (cur < text.length) parts.push({ divine: false, text: text.slice(cur) });
  return parts;
}
