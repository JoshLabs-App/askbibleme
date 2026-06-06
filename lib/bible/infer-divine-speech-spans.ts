/**
 * 试点：自动推断「神 / 主耶稣直接发言」类文字在节内的字符区间（UTF-16 索引，与 String#slice 一致）。
 * 含和合本式「耶稣说…「…」」与跨节延续；规则偏宽、仅覆盖少量书卷用于试错。
 *
 * 移动端副本：`apps/askbible-mobile/src/bible/infer-divine-speech-spans.ts`（改规则时请两处同步）。
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

const GOSPEL_BOOKS = new Set(["MAT", "MRK", "LUK", "JHN"]);

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

export function translationSupportsSpeechHighlight(translationId: string): boolean {
  return heuristicLocale(translationId) != null;
}

export type SpeechHighlightKind = "plain" | "divine" | "human";

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

/** 经文中所有引号内对白（「」、"" 等），供与神言区间相减后标「人说话」。 */
export function inferAllQuotedSpeechSpans(text: string, translationId: string): DivineSpeechSpan[] {
  const loc = heuristicLocale(translationId);
  if (!loc) return [];
  const spans = loc === "zh" ? zhAllQuotedSpans(text) : enAllQuotedSpans(text);
  return mergeDivineSpeechSpans(spans).filter((s) => s.start < s.end && s.end <= text.length);
}

/** 神言 + 其他人引语（引号内且非神言）分色渲染 */
export function splitTextBySpeechHighlights(
  text: string,
  ctx: DivineSpeechInferContext,
): Array<{ kind: SpeechHighlightKind; text: string }> {
  return splitVerseSpeechHighlights(text, ctx, false).parts;
}

/** 整章分节高亮，处理「说：「…」跨节未闭合」的神谕延续 */
export function splitChapterVersesBySpeechHighlights(
  verses: readonly { verse: number; text: string }[],
  base: Omit<DivineSpeechInferContext, "verse">,
): Array<Array<{ kind: SpeechHighlightKind; text: string }>> {
  if (!translationSupportsSpeechHighlight(base.translationId)) {
    return verses.map((v) => [{ kind: "plain", text: v.text }]);
  }
  let insideDivineQuote = false;
  const out: Array<Array<{ kind: SpeechHighlightKind; text: string }>> = [];
  for (const v of verses) {
    const ctx = { ...base, verse: v.verse };
    const { parts, insideDivineQuote: next } = splitVerseSpeechHighlights(v.text, ctx, insideDivineQuote);
    out.push(parts);
    insideDivineQuote = next;
  }
  return out;
}

function splitVerseSpeechHighlights(
  text: string,
  ctx: DivineSpeechInferContext,
  insideDivineQuote: boolean,
): { parts: Array<{ kind: SpeechHighlightKind; text: string }>; insideDivineQuote: boolean } {
  if (!translationSupportsSpeechHighlight(ctx.translationId)) {
    return { parts: [{ kind: "plain", text }], insideDivineQuote: false };
  }
  if (!text.length) return { parts: [], insideDivineQuote: false };

  const loc = heuristicLocale(ctx.translationId);
  const divine: DivineSpeechSpan[] = [];
  let nextInside = false;

  if (loc === "zh" && insideDivineQuote) {
    const closeAt = zhFirstCloseGuillemetIndex(text);
    if (closeAt === -1) {
      divine.push({ start: 0, end: text.length });
      nextInside = true;
    } else {
      divine.push({ start: 0, end: closeAt + 1 });
      const rest = text.slice(closeAt + 1);
      if (rest.trim()) {
        divine.push(
          ...offsetSpans(inferDivineSpeechSpans(rest, ctx), closeAt + 1),
        );
      }
      nextInside = false;
    }
  } else {
    divine.push(...inferDivineSpeechSpans(text, ctx));
    if (loc === "zh" && verseOpensDivineGuillemetContinuation(text, ctx)) {
      nextInside = true;
    }
  }

  const quoted = inferAllQuotedSpeechSpans(text, ctx.translationId);
  const human = subtractSpans(quoted, divine);

  const kinds: SpeechHighlightKind[] = Array(text.length).fill("plain");
  for (const s of human) {
    for (let i = s.start; i < s.end; i++) kinds[i] = "human";
  }
  for (const s of divine) {
    for (let i = s.start; i < s.end; i++) kinds[i] = "divine";
  }

  return { parts: coalesceSpeechKinds(text, kinds), insideDivineQuote: nextInside };
}

function offsetSpans(spans: DivineSpeechSpan[], offset: number): DivineSpeechSpan[] {
  return spans.map((s) => ({ start: s.start + offset, end: s.end + offset }));
}

function zhFirstCloseGuillemetIndex(text: string): number {
  let best = -1;
  for (const close of ["」", "』"] as const) {
    const idx = text.indexOf(close);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

/** 本节有耶和华/神…说 且引号未闭合 → 后续节续接神谕 */
function verseOpensDivineGuillemetContinuation(
  text: string,
  ctx: DivineSpeechInferContext,
): boolean {
  if (!zhSpansFromSpeechTriggers(text, ctx).length) return false;
  const lastOpen = Math.max(text.lastIndexOf("「"), text.lastIndexOf("『"));
  if (lastOpen === -1) return false;
  const o = text[lastOpen]!;
  const close = o === "「" ? "」" : "』";
  return text.indexOf(close, lastOpen + 1) === -1;
}

function subtractSpans(from: readonly DivineSpeechSpan[], remove: readonly DivineSpeechSpan[]): DivineSpeechSpan[] {
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

function coalesceSpeechKinds(
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

function zhAllQuotedSpans(text: string): DivineSpeechSpan[] {
  const spans: DivineSpeechSpan[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c !== "「" && c !== "『") continue;
    const sp = zhSpanFromGuillemet(text, i);
    if (sp) {
      spans.push(sp);
      i = Math.max(i, sp.end - 1);
    }
  }
  return spans;
}

function enAllQuotedSpans(text: string): DivineSpeechSpan[] {
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

const ZH_DIVINE_SPEECH_TRIGGER_RE =
  /(?:神吩咐这一切的话说|耶和华如此说|耶和華如此說|万军之耶和华说|萬軍之耶和華說|主耶和华说|主耶和華說|耶和华说|耶和華說|神晓谕|神曉諭|神吩咐|神说|神說|神就说|神就說|神(?:就)?(?:称|稱)[^。！？「」\n]{0,20}?(?:为|為)|从天上有声音说|從天上有聲音說|有声音从天上说|有聲音從天上說|有声音从天上来[，,]?说|有聲音從天上來[，,]?說|有声音从云里出来说|有聲音從雲裡出來說|有声音从云彩里出来说|有聲音從雲彩裡出來說|有声音从云里出来[，,]?说|有聲音從雲裡出來[，,]?說|有声音从云彩里出来[，,]?说|有聲音從雲彩裡出來[，,]?說|耶穌回答說|耶稣回答说|耶穌對他們說|耶稣对他们说|耶穌就對他們說|耶稣就对他们说|耶穌說|耶稣说|(?:耶和华|耶和華|万军之耶和华|萬軍之耶和華|主耶和华|主耶和華|神)(?:[^。！？；;：「」『』\n]{0,14}?)(?:说|說|吩咐|晓谕|曉諭)|(?:耶穌|耶稣)(?:就|又|便)?(?:回答說|回答说|說|说|對[^。！？；;：「」『』\n]{0,8}說|对[^。！？；;：「」『』\n]{0,8}说))/g;
const ZH_GOSPEL_JESUS_PRONOUN_TRIGGER_RE =
  /(?:他用比喻对他们讲许多道理，说|他用比喻對他們講許多道理，說)/g;

function zhSpansFromSpeechTriggers(text: string, ctx: DivineSpeechInferContext): DivineSpeechSpan[] {
  const spans: DivineSpeechSpan[] = [];
  const re = ZH_DIVINE_SPEECH_TRIGGER_RE;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (zhShouldSkipDivineCue(text, m.index, m[0])) continue;
    const after = m.index + m[0].length;
    const span = zhSpanAfterSpeechCue(text, after);
    if (span) spans.push(span);
  }
  if (GOSPEL_BOOKS.has(ctx.bookId)) {
    const pronounRe = ZH_GOSPEL_JESUS_PRONOUN_TRIGGER_RE;
    let pm: RegExpExecArray | null;
    while ((pm = pronounRe.exec(text)) !== null) {
      const after = pm.index + pm[0].length;
      const span = zhSpanAfterSpeechCue(text, after);
      if (span) spans.push(span);
    }
  }
  return spans;
}

function zhShouldSkipDivineCue(text: string, cueStart: number, cue: string): boolean {
  if (
    /(?:求他说|求他說|对他说|對他說|问他说|問他說|向他说|向他說)$/.test(cue)
  ) {
    return true;
  }
  if (!/(?:耶稣说|耶穌說)$/.test(cue)) return false;
  const left = text.slice(Math.max(0, cueStart - 8), cueStart);
  // 诸如「门徒…问耶稣说」属于人的提问，不应标成主言。
  return /(?:问|問|对|對|求)\s*$/.test(left);
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
