/**
 * 试点：自动推断「神 / 主耶稣直接发言」类文字在节内的字符区间（UTF-16 索引，与 String#slice 一致）。
 * 含和合本式「耶稣说…「…」」与跨节延续；规则偏宽、仅覆盖少量书卷用于试错。
 */

export type DivineSpeechSpan = { start: number; end: number };

const PILOT_CHAPTERS: readonly { bookId: string; chapter: number }[] = [
  { bookId: "GEN", chapter: 1 },
  { bookId: "EXO", chapter: 20 },
  { bookId: "JHN", chapter: 3 },
];

export function isDivineSpeechPilotChapter(bookId: string, chapter: number): boolean {
  return PILOT_CHAPTERS.some((e) => e.bookId === bookId && e.chapter === chapter);
}

export type DivineSpeechInferContext = {
  translationId: string;
  bookId: string;
  chapter: number;
  /** 节号；部分规则需按节处理（如十诫跨节引语）。 */
  verse: number;
};

/** 十诫：第 4、7 节等有「」；第 5–6 节为同段神谕续句，译本常无起引号。 */
function exo20Verses5And6FullVerseDivine(ctx: DivineSpeechInferContext, text: string): DivineSpeechSpan | null {
  if (ctx.bookId !== "EXO" || ctx.chapter !== 20) return null;
  if (ctx.verse !== 5 && ctx.verse !== 6) return null;
  if (!text.trim()) return null;
  return { start: 0, end: text.length };
}

/**
 * 约 3：「耶稣说」后引语常跨多节；中文 v31 起有全段「」体（多视为主言），英文 WEB 同段为约翰叙述，故仅中文扩到 v36。
 */
function jhn3JesusContinuationFullVerse(
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

export function inferDivineSpeechSpans(text: string, ctx: DivineSpeechInferContext): DivineSpeechSpan[] {
  if (!isDivineSpeechPilotChapter(ctx.bookId, ctx.chapter)) return [];
  const loc = heuristicLocale(ctx.translationId);
  if (!loc) return [];
  const spans: DivineSpeechSpan[] = [];
  const exo56 = exo20Verses5And6FullVerseDivine(ctx, text);
  if (exo56) spans.push(exo56);
  const jhn3Cont = jhn3JesusContinuationFullVerse(ctx, text, loc);
  if (jhn3Cont) spans.push(jhn3Cont);
  if (loc === "zh") {
    spans.push(...zhSpansFromSpeechTriggers(text));
    const lead = zhLeadingGuillemetInnerSpan(text);
    if (lead) spans.push(lead);
  } else {
    spans.push(...enSpansFromSpeechTriggers(text));
    const lead = enLeadingAsciiOrCurlyQuoteInnerSpan(text);
    if (lead) spans.push(lead);
  }
  return mergeDivineSpeechSpans(spans).filter((s) => s.start < s.end && s.end <= text.length);
}

/** 供 UI 切分渲染；`spans` 已为合并后的区间亦可。 */
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

function heuristicLocale(translationId: string): "zh" | "en" | null {
  const id = String(translationId || "").toLowerCase().trim();
  if (id === "cuv-simp" || id === "cuv-trad" || id.includes("cuv")) return "zh";
  if (id === "web-en" || id === "bbe-en") return "en";
  return null;
}

function mergeDivineSpeechSpans(spans: DivineSpeechSpan[]): DivineSpeechSpan[] {
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

function skipWsOptionalCommaWs(text: string, start: number): number {
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

function skipChineseColon(text: string, start: number): number {
  let j = start;
  if (j < text.length && (text[j] === "：" || text[j] === ":")) {
    j++;
    while (j < text.length && /\s/.test(text[j]!)) j++;
  }
  return j;
}

/** 引号内；若无闭合引号则偏宽：从开引号后到节末。 */
function zhSpanFromGuillemet(text: string, openIdx: number): DivineSpeechSpan | null {
  if (openIdx < 0 || openIdx >= text.length) return null;
  const o = text[openIdx];
  if (o !== "「" && o !== "『") return null;
  const close = o === "「" ? "」" : "』";
  const innerStart = openIdx + 1;
  const closeIdx = text.indexOf(close, innerStart);
  if (closeIdx === -1) return { start: innerStart, end: text.length };
  return { start: innerStart, end: closeIdx };
}

function zhSpansFromSpeechTriggers(text: string): DivineSpeechSpan[] {
  const spans: DivineSpeechSpan[] = [];
  const re =
    /(?:神吩咐这一切的话说|耶和华如此说|耶和華如此說|万军之耶和华说|萬軍之耶和華說|主耶和华说|主耶和華說|耶和华说|耶和華說|神晓谕|神曉諭|神吩咐|神说|神說|神就说|神就說|耶穌回答說|耶稣回答说|耶穌對他們說|耶稣对他们说|耶穌就對他們說|耶稣就对他们说|耶穌說|耶稣说)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const after = m.index + m[0].length;
    const span = zhSpanAfterSpeechCue(text, after);
    if (span) spans.push(span);
  }
  return spans;
}

function zhSpanAfterSpeechCue(text: string, cueEnd: number): DivineSpeechSpan | null {
  let j = skipWsOptionalCommaWs(text, cueEnd);
  j = skipChineseColon(text, j);
  if (j >= text.length) return null;
  const c = text[j]!;
  if (c === "「" || c === "『") return zhSpanFromGuillemet(text, j);
  // 偏宽：无引号则从当前位置到节末（如部分宣告体）
  return { start: j, end: text.length };
}

/** 节首以「/『 起句、上节为「说：」类引导时常见（如十诫）。 */
function zhLeadingGuillemetInnerSpan(text: string): DivineSpeechSpan | null {
  let i = 0;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  if (i >= text.length) return null;
  return zhSpanFromGuillemet(text, i);
}

const EN_TRIGGER_SOURCE =
  [
    "God spoke all these words, saying",
    "Thus saith the LORD",
    "Thus says the LORD",
    "Thus says Yahweh",
    "The word of the LORD came to",
    "The word of Yahweh came to",
    "Jesus answered him",
    "Jesus answered",
    "Jesus said to him",
    "Jesus said to them",
    "Jesus said",
    "God said",
    "God spoke",
    "The LORD said",
    "Yahweh said",
  ]
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

function enSpansFromSpeechTriggers(text: string): DivineSpeechSpan[] {
  const spans: DivineSpeechSpan[] = [];
  const re = new RegExp(EN_TRIGGER_SOURCE, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const after = m.index + m[0].length;
    const span = enSpanAfterSpeechCue(text, after);
    if (span) spans.push(span);
  }
  return spans;
}

function enSpanAfterSpeechCue(text: string, cueEnd: number): DivineSpeechSpan | null {
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

function enInnerSpanBalancedAsciiDoubleQuote(text: string, openIdx: number): DivineSpeechSpan | null {
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

function enLeadingAsciiOrCurlyQuoteInnerSpan(text: string): DivineSpeechSpan | null {
  let i = 0;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  if (i >= text.length) return null;
  const c = text[i]!;
  if (c === "\u201c") {
    const end = text.indexOf("\u201d", i + 1);
    if (end === -1) return { start: i + 1, end: text.length };
    return { start: i + 1, end: end };
  }
  if (c === '"') return enInnerSpanBalancedAsciiDoubleQuote(text, i);
  return null;
}
