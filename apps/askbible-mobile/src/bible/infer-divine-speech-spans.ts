/**
 * 与仓库根目录 `lib/bible/infer-divine-speech-spans.ts` 保持同步。
 * 试点：自动推断「神 / 主耶稣直接发言」在节内的字符区间。
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
  verse: number;
};

const GOSPEL_BOOKS = new Set(["MAT", "MRK", "LUK", "JHN"]);

function exo20Verses5And6FullVerseDivine(ctx: DivineSpeechInferContext, text: string): DivineSpeechSpan | null {
  if (ctx.bookId !== "EXO" || ctx.chapter !== 20) return null;
  if (ctx.verse !== 5 && ctx.verse !== 6) return null;
  if (!text.trim()) return null;
  return { start: 0, end: text.length };
}

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

export function inferAllQuotedSpeechSpans(text: string, translationId: string): DivineSpeechSpan[] {
  const loc = heuristicLocale(translationId);
  if (!loc) return [];
  const spans = loc === "zh" ? zhAllQuotedSpans(text) : enAllQuotedSpans(text);
  return mergeDivineSpeechSpans(spans).filter((s) => s.start < s.end && s.end <= text.length);
}

export function splitTextBySpeechHighlights(
  text: string,
  ctx: DivineSpeechInferContext,
): Array<{ kind: SpeechHighlightKind; text: string }> {
  return splitVerseSpeechHighlights(text, ctx, null, {
    pendingDivineReply: false,
    divineDiscourseActive: false,
  }).parts;
}

export function splitChapterVersesBySpeechHighlights(
  verses: readonly { verse: number; text: string }[],
  base: Omit<DivineSpeechInferContext, "verse">,
): Array<Array<{ kind: SpeechHighlightKind; text: string }>> {
  if (!translationSupportsSpeechHighlight(base.translationId)) {
    return verses.map((v) => [{ kind: "plain", text: v.text }]);
  }
  let quoteContinuation: QuoteContinuationState = null;
  let speakerState: SpeakerInferenceState = {
    pendingDivineReply: false,
    divineDiscourseActive: false,
  };
  const out: Array<Array<{ kind: SpeechHighlightKind; text: string }>> = [];
  for (const v of verses) {
    const ctx = { ...base, verse: v.verse };
    const { parts, quoteContinuation: next, speakerState: nextSpeakerState } = splitVerseSpeechHighlights(
      v.text,
      ctx,
      quoteContinuation,
      speakerState,
    );
    out.push(parts);
    quoteContinuation = next;
    speakerState = nextSpeakerState;
  }
  return out;
}

type QuoteContinuationState = {
  kind: Exclude<SpeechHighlightKind, "plain">;
  closeChar: string;
} | null;

type SpeakerInferenceState = {
  pendingDivineReply: boolean;
  divineDiscourseActive: boolean;
};

const ZH_CLOSE_QUOTES = ["」", "』", "﹂", "﹄"] as const;

function splitVerseSpeechHighlights(
  text: string,
  ctx: DivineSpeechInferContext,
  quoteContinuation: QuoteContinuationState,
  speakerState: SpeakerInferenceState,
): {
  parts: Array<{ kind: SpeechHighlightKind; text: string }>;
  quoteContinuation: QuoteContinuationState;
  speakerState: SpeakerInferenceState;
} {
  if (!translationSupportsSpeechHighlight(ctx.translationId)) {
    return {
      parts: [{ kind: "plain", text }],
      quoteContinuation: null,
      speakerState,
    };
  }
  if (!text.length) {
    return {
      parts: [],
      quoteContinuation: null,
      speakerState: { ...speakerState, pendingDivineReply: false },
    };
  }

  const loc = heuristicLocale(ctx.translationId);
  const kinds: SpeechHighlightKind[] = Array(text.length).fill("plain");
  const divine: DivineSpeechSpan[] = [];
  let nextContinuation: QuoteContinuationState = null;
  let nextSpeakerState: SpeakerInferenceState = { ...speakerState, pendingDivineReply: false };

  if (quoteContinuation) {
    const closeAt = findContinuationCloseIndex(text, quoteContinuation.closeChar);
    const end = closeAt === -1 ? text.length : closeAt + 1;
    for (let i = 0; i < end; i++) {
      kinds[i] = quoteContinuation.kind;
    }
    if (closeAt === -1) {
      return {
        parts: coalesceSpeechKinds(text, kinds),
        quoteContinuation,
        speakerState: {
          ...nextSpeakerState,
          divineDiscourseActive: quoteContinuation.kind === "divine",
        },
      };
    }
  }

  const quoted = inferAllQuotedSpeechSpans(text, ctx.translationId);
  const divineFromTriggers = intersectSpans(inferDivineSpeechSpans(text, ctx), quoted);
  divine.push(...divineFromTriggers);
  const treatQuotedAsDivineByContext = shouldTreatQuotedAsDivineByContext(
    text,
    ctx,
    loc,
    quoted,
    divineFromTriggers,
    speakerState,
  );
  if (treatQuotedAsDivineByContext) {
    divine.push(...quoted);
  }
  const human = subtractSpans(quoted, divine);

  for (const s of human) {
    for (let i = s.start; i < s.end; i++) kinds[i] = "human";
  }
  for (const s of divine) {
    for (let i = s.start; i < s.end; i++) kinds[i] = "divine";
  }

  const unmatched = findLastUnclosedQuote(text);
  if (unmatched) {
    const innerIdx = unmatched.openIndex + 1;
    const k = innerIdx < kinds.length ? kinds[innerIdx] : "plain";
    const continuationKind: Exclude<SpeechHighlightKind, "plain"> = k === "divine" ? "divine" : "human";
    nextContinuation = { kind: continuationKind, closeChar: unmatched.closeChar };
  }

  const hasQuotedSpeech = quoted.length > 0;
  const hasExplicitDivineCue = divineFromTriggers.length > 0;
  const hasAskingDivineCue = detectAskingDivineCue(text, loc);
  const hasStrongHumanCue = detectStrongHumanCue(text, loc);

  const verseDivineSpeech =
    hasQuotedSpeech && (hasExplicitDivineCue || treatQuotedAsDivineByContext || nextContinuation?.kind === "divine");
  nextSpeakerState.divineDiscourseActive = verseDivineSpeech || (speakerState.divineDiscourseActive && !hasStrongHumanCue);
  if (hasStrongHumanCue) {
    nextSpeakerState.divineDiscourseActive = false;
  }
  if (hasAskingDivineCue) {
    nextSpeakerState.pendingDivineReply = true;
  }

  return {
    parts: coalesceSpeechKinds(text, kinds),
    quoteContinuation: nextContinuation,
    speakerState: nextSpeakerState,
  };
}

function shouldTreatQuotedAsDivineByContext(
  text: string,
  ctx: DivineSpeechInferContext,
  loc: "zh" | "en" | null,
  quoted: readonly DivineSpeechSpan[],
  divineFromTriggers: readonly DivineSpeechSpan[],
  state: SpeakerInferenceState,
): boolean {
  if (!quoted.length || !loc) return false;
  if (divineFromTriggers.length > 0) return true;
  if (!GOSPEL_BOOKS.has(ctx.bookId)) return false;
  if (detectStrongHumanCue(text, loc)) return false;

  const startsWithQuote = startsWithKnownOpenQuote(text);
  const hasPronounSpeechCue = detectPronounSpeechCue(text, loc);
  if (state.pendingDivineReply && (hasPronounSpeechCue || startsWithQuote)) return true;
  if (state.divineDiscourseActive && startsWithQuote) return true;
  return false;
}

function findContinuationCloseIndex(text: string, closeChar: string): number {
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

const QUOTE_PAIRS = new Map<string, string>([
  ["「", "」"],
  ["『", "』"],
  ["“", "”"],
  ["‘", "’"],
  ["﹁", "﹂"],
  ["﹃", "﹄"],
  ['"', '"'],
]);

const OPEN_QUOTES = new Set<string>(QUOTE_PAIRS.keys());

function startsWithKnownOpenQuote(text: string): boolean {
  const s = text.trimStart();
  if (!s) return false;
  return OPEN_QUOTES.has(s[0]!);
}

const ZH_PRONOUN_SPEECH_CUE_RE =
  /(?:^|[，。；\s])他(?:就|又)?(?:說|说|回答說|回答说|回答|對[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}說|对[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}说|大聲說|大声说|吩咐|講|讲)\s*[:：]?/;
const EN_PRONOUN_SPEECH_CUE_RE =
  /(?:^|[\s,.;])he(?:\s+(?:said|answered|replied|cried|spoke|told(?:\s+\w+)?))\s*:?\s*/i;

const ZH_ASKING_DIVINE_CUE_RE =
  /(?:(?:问|問|对|對|向|求)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,8}(?:耶穌|耶稣|主耶穌|主耶稣|耶和華|耶和华|神|主)|(?:門徒|门徒|眾人|众人|法利賽人|法利赛人|百姓)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,8}(?:问|問)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,6}(?:耶穌|耶稣|主耶穌|主耶稣|耶和華|耶和华|神|主))[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}(?:說|说|請教|请教|回答|回覆|回复)/;
const EN_ASKING_DIVINE_CUE_RE =
  /(?:asked|said to|spoke to|questioned)\s+(?:jesus|the lord|yahweh|god)\b/i;

const ZH_STRONG_HUMAN_CUE_RE =
  /(?:蛇|女人|婦人|妇人|門徒|门徒|眾人|众人|法利賽人|法利赛人|百姓|彼得|亞伯拉罕|亚伯拉罕|摩西|撒但|魔鬼|他們|他们)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}(?:說|说|問|问|回答|大聲說|大声说|吩咐)/;
const EN_STRONG_HUMAN_CUE_RE =
  /(?:the disciples|the crowd|the people|pharisees|the woman|the serpent|peter|they)\b[^"\n]{0,18}(?:said|asked|answered|replied|cried)/i;

function detectPronounSpeechCue(text: string, loc: "zh" | "en"): boolean {
  return loc === "zh" ? ZH_PRONOUN_SPEECH_CUE_RE.test(text) : EN_PRONOUN_SPEECH_CUE_RE.test(text);
}

function detectAskingDivineCue(text: string, loc: "zh" | "en" | null): boolean {
  if (!loc) return false;
  return loc === "zh" ? ZH_ASKING_DIVINE_CUE_RE.test(text) : EN_ASKING_DIVINE_CUE_RE.test(text);
}

function detectStrongHumanCue(text: string, loc: "zh" | "en" | null): boolean {
  if (!loc) return false;
  return loc === "zh" ? ZH_STRONG_HUMAN_CUE_RE.test(text) : EN_STRONG_HUMAN_CUE_RE.test(text);
}

function findLastUnclosedQuote(text: string): { openIndex: number; closeChar: string } | null {
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
  // 续引号按最外层未闭合引号延续，避免内层嵌套打乱下一节颜色。
  return stack.length ? stack[0]! : null;
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

function intersectSpans(a: readonly DivineSpeechSpan[], b: readonly DivineSpeechSpan[]): DivineSpeechSpan[] {
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
  return collectQuotedInnerSpans(text, ZH_QUOTE_PAIRS);
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

const ZH_DIVINE_SPEECH_TRIGGER_RE =
  /(?:神吩咐这一切的话说|耶和华如此说|耶和華如此說|万军之耶和华说|萬軍之耶和華說|主耶和华说|主耶和華说|耶和华说|耶和華说|神晓谕|神曉諭|神吩咐|神说|神說|神就说|神就說|神(?:就)?(?:称|稱)[^。！？「」\n]{0,20}?(?:为|為)|从天上有声音说|從天上有聲音說|有声音从天上说|有聲音從天上說|有声音从天上来[，,]?说|有聲音從天上來[，,]?說|有声音从云里出来说|有聲音從雲裡出來說|有声音从云彩里出来说|有聲音從雲彩裡出來說|有声音从云里出来[，,]?说|有聲音從雲裡出來[，,]?說|有声音从云彩里出来[，,]?说|有聲音從雲彩裡出來[，,]?說|耶穌回答說|耶稣回答说|耶穌對他們說|耶稣对他们说|耶穌就對他們說|耶稣就对他们说|耶穌說|耶稣说|(?:耶和华|耶和華|万军之耶和华|萬軍之耶和華|主耶和华|主耶和華|神)(?:[^。！？；;：「」『』\n]{0,14}?)(?:说|說|吩咐|晓谕|曉諭)|(?:耶穌|耶稣)(?:就|又|便)?(?:回答說|回答说|說|说|對[^。！？；;：「」『』\n]{0,8}說|对[^。！？；;：「」『』\n]{0,8}说))/g;
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
  if (ZH_QUOTE_PAIRS.has(c)) return zhSpanFromOpenQuote(text, j);
  return { start: j, end: text.length };
}

const ZH_QUOTE_PAIRS = new Map<string, string>([
  ["「", "」"],
  ["『", "』"],
  ["“", "”"],
  ["‘", "’"],
  ["﹁", "﹂"],
  ["﹃", "﹄"],
]);

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
