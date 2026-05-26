import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createChatCompletion } from "../lib/ai/openai-compatible";
import type { ResolvedAISettings } from "../lib/ai/types";
import { parseAndValidateBiblePayload } from "../lib/bible/validate-bible-json";
import { resolveTranslationAbsolutePath } from "../lib/bible/translations-store";
import {
  SPEECH_SPANS_REVIEW_STATE_REL_PATH,
  type SpeechReviewChapterStatus,
  type SpeechSpansReviewState,
} from "../lib/bible/speech-spans-review-state";

type SpeechKind = "divine" | "human";
type StoredSpeechSpanTuple = [number, number, 1 | 2];
type VerseRow = { verse: number; text: string };

const GOSPEL_BOOK_IDS = ["MAT", "MRK", "LUK", "JHN"] as const;

function readEnvInt(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? "");
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.trunc(raw));
}

function readSettingsFromLocalConfig(
  cwd: string,
): { baseUrl: string; model: string; apiKey?: string } | null {
  const file = path.join(cwd, "data", "admin", "ai-api-config.json");
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      slots?: Array<{
        id?: string;
        enabled?: boolean;
        baseUrl?: string;
        model?: string;
        apiKey?: string;
      }>;
      studioConnections?: Array<{
        id?: string;
        baseUrl?: string;
        model?: string;
      }>;
    };
    const preferId = String(process.env.SPEECH_SPANS_AI_CONNECTION_ID ?? "").trim();
    const slotById = raw.slots?.find((s) => String(s.id ?? "").trim() === preferId);
    if (
      slotById &&
      slotById.enabled !== false &&
      String(slotById.baseUrl ?? "").trim() &&
      String(slotById.model ?? "").trim()
    ) {
      return {
        baseUrl: String(slotById.baseUrl).trim(),
        model: String(slotById.model).trim(),
        apiKey: String(slotById.apiKey ?? "").trim() || undefined,
      };
    }
    const studioById = raw.studioConnections?.find((s) => String(s.id ?? "").trim() === preferId);
    if (studioById && String(studioById.baseUrl ?? "").trim() && String(studioById.model ?? "").trim()) {
      return {
        baseUrl: String(studioById.baseUrl).trim(),
        model: String(studioById.model).trim(),
      };
    }
    const firstStudio = raw.studioConnections?.find(
      (s) => String(s.baseUrl ?? "").trim() && String(s.model ?? "").trim(),
    );
    if (firstStudio) {
      return {
        baseUrl: String(firstStudio.baseUrl).trim(),
        model: String(firstStudio.model).trim(),
      };
    }
    const firstGateway = raw.slots?.find(
      (s) =>
        s.enabled !== false &&
        String(s.baseUrl ?? "").trim() &&
        String(s.model ?? "").trim(),
    );
    if (firstGateway) {
      return {
        baseUrl: String(firstGateway.baseUrl).trim(),
        model: String(firstGateway.model).trim(),
        apiKey: String(firstGateway.apiKey ?? "").trim() || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function parseSettings(cwd: string): ResolvedAISettings {
  const baseUrlRaw = String(process.env.AI_BASE_URL ?? "").trim();
  const model = String(process.env.AI_MODEL ?? "").trim();
  const fromConfig = !baseUrlRaw || !model ? readSettingsFromLocalConfig(cwd) : null;
  const baseUrl = (baseUrlRaw || fromConfig?.baseUrl || "").trim();
  const modelResolved = (model || fromConfig?.model || "").trim();
  if (!baseUrl) {
    throw new Error(
      "缺少 AI_BASE_URL。请设置 AI_BASE_URL / AI_MODEL，或在 data/admin/ai-api-config.json 配置 studioConnections。",
    );
  }
  if (!modelResolved) {
    throw new Error(
      "缺少 AI_MODEL。请设置 AI_MODEL，或在 data/admin/ai-api-config.json 的连接中提供 model。",
    );
  }
  const envKey = String(process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  return {
    provider: "openai-compatible",
    baseUrl: baseUrl.replace(/\/$/, ""),
    model: modelResolved,
    apiKey: envKey || fromConfig?.apiKey || undefined,
  };
}

function parseTranslations(): string[] {
  const raw = String(process.env.SPEECH_SPANS_AI_TRANSLATIONS ?? "cuv-simp");
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!out.length) return ["cuv-simp"];
  return [...new Set(out)];
}

function readTranslationBooks(cwd: string, translationId: string): Record<string, Record<string, Record<string, string>>> {
  const abs = resolveTranslationAbsolutePath(cwd, translationId);
  if (!fs.existsSync(abs)) {
    throw new Error(`译本不存在：${translationId} (${abs})`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  const parsed = parseAndValidateBiblePayload(raw);
  return parsed.books;
}

function listChapterVerses(
  books: Record<string, Record<string, Record<string, string>>>,
  bookId: string,
  chapter: number,
): VerseRow[] {
  const chapterMap = books?.[bookId]?.[String(chapter)];
  if (!chapterMap || typeof chapterMap !== "object") return [];
  return Object.keys(chapterMap)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 1)
    .sort((a, b) => a - b)
    .map((verse) => ({ verse, text: String(chapterMap[String(verse)] ?? "").trim() }))
    .filter((v) => v.text.length > 0);
}

function findGospelChapters(
  books: Record<string, Record<string, Record<string, string>>>,
): Array<{ bookId: string; chapter: number; verses: VerseRow[] }> {
  const out: Array<{ bookId: string; chapter: number; verses: VerseRow[] }> = [];
  for (const bookId of GOSPEL_BOOK_IDS) {
    const chapterObj = books[bookId];
    if (!chapterObj || typeof chapterObj !== "object") continue;
    const chapterNums = Object.keys(chapterObj)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1)
      .sort((a, b) => a - b);
    for (const chapter of chapterNums) {
      const verses = listChapterVerses(books, bookId, chapter);
      if (verses.length) out.push({ bookId, chapter, verses });
    }
  }
  return out;
}

function speechPromptSystem(): string {
  return [
    "你是圣经经文标注器。任务：按节提取“直接说话片段”，并分类为 divine 或 human。",
    "分类规则：",
    "1) divine：神（天父/耶和华）直接发言，或耶稣直接发言。",
    "2) human：其它被引号或语义明确的直接发言（门徒、群众、法利赛人、天使、鬼等）。",
    "3) narration（叙述句）不要标注。",
    "4) 必须返回经文中的原文子串，不能改写、不能补字。",
    "输出要求：只输出纯文本行，不要 Markdown，不要解释，不要代码块。",
    "每一行格式：<verse>\\t<kind>\\t<text>",
    "其中 <kind> 只能是 divine 或 human。",
    "示例：17\\tdivine\\t这是我的爱子，我所喜悦的。",
  ].join("\n");
}

function speechPromptUser(input: { translationId: string; bookId: string; chapter: number; verses: VerseRow[] }): string {
  return JSON.stringify(
    {
      task: "annotate_direct_speech",
      translationId: input.translationId,
      bookId: input.bookId,
      chapter: input.chapter,
      verses: input.verses,
      constraints: {
        tsvOnly: true,
        preserveExactSubstring: true,
      },
    },
    null,
    2,
  );
}

function parseJsonObjectFromModel(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const unwrapped = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(unwrapped) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("模型返回不是对象 JSON");
    }
    return parsed as Record<string, unknown>;
  } catch {
    const start = unwrapped.indexOf("{");
    const end = unwrapped.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("模型返回无法解析为 JSON");
    }
    const sliced = unwrapped.slice(start, end + 1);
    const parsed = JSON.parse(sliced) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("模型返回不是对象 JSON");
    }
    return parsed as Record<string, unknown>;
  }
}

function toSpeechKind(v: unknown): SpeechKind | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "神" || s === "耶稣" || s === "耶穌" || s === "上帝" || s === "天父") return "divine";
  if (s === "人" || s === "人物") return "human";
  if (s === "divine" || s === "human") return s;
  return null;
}

const MATCH_IGNORE_CHARS = new Set([
  " ",
  "\n",
  "\r",
  "\t",
  "，",
  ",",
  "。",
  ".",
  "！",
  "!",
  "？",
  "?",
  "；",
  ";",
  "：",
  ":",
  "、",
  "“",
  "”",
  "\"",
  "'",
  "‘",
  "’",
  "「",
  "」",
  "『",
  "』",
  "(",
  ")",
  "（",
  "）",
  "《",
  "》",
]);

function stripOuterQuotes(text: string): string {
  let out = text.trim();
  const pairs: Array<[string, string]> = [
    ["“", "”"],
    ["\"", "\""],
    ["「", "」"],
    ["『", "』"],
    ["'", "'"],
    ["‘", "’"],
  ];
  let changed = true;
  while (changed && out.length >= 2) {
    changed = false;
    for (const [l, r] of pairs) {
      if (out.startsWith(l) && out.endsWith(r) && out.length > l.length + r.length) {
        out = out.slice(l.length, out.length - r.length).trim();
        changed = true;
        break;
      }
    }
  }
  return out;
}

function normalizeForMatch(source: string): { normalized: string; indexMap: number[] } {
  const chars: string[] = [];
  const indexMap: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (MATCH_IGNORE_CHARS.has(ch)) continue;
    chars.push(ch);
    indexMap.push(i);
  }
  return { normalized: chars.join(""), indexMap };
}

function normalizedOffsetForCursor(indexMap: number[], cursor: number): number {
  for (let i = 0; i < indexMap.length; i++) {
    if (indexMap[i]! >= cursor) return i;
  }
  return indexMap.length;
}

function findSegmentSpan(verseText: string, segmentText: string, cursor: number): { start: number; end: number } | null {
  const direct = verseText.indexOf(segmentText, cursor);
  if (direct >= 0) return { start: direct, end: direct + segmentText.length };
  const directAny = verseText.indexOf(segmentText);
  if (directAny >= 0) return { start: directAny, end: directAny + segmentText.length };

  const normalizedVerse = normalizeForMatch(verseText);
  const normalizedSeg = normalizeForMatch(segmentText);
  if (!normalizedSeg.normalized) return null;
  const startAt = normalizedOffsetForCursor(normalizedVerse.indexMap, cursor);
  let normIdx = normalizedVerse.normalized.indexOf(normalizedSeg.normalized, startAt);
  if (normIdx < 0) {
    normIdx = normalizedVerse.normalized.indexOf(normalizedSeg.normalized);
  }
  if (normIdx < 0) return null;

  const start = normalizedVerse.indexMap[normIdx];
  const endIdx = normIdx + normalizedSeg.normalized.length - 1;
  const endPos = normalizedVerse.indexMap[endIdx];
  if (start == null || endPos == null) return null;
  return { start, end: endPos + 1 };
}

function encodeSpansFromSegments(verseText: string, segments: Array<{ kind: SpeechKind; text: string }>): string {
  if (!segments.length) return "";
  const tuples: StoredSpeechSpanTuple[] = [];
  let cursor = 0;
  for (const seg of segments) {
    const target = stripOuterQuotes(seg.text);
    if (!target) continue;
    const matched = findSegmentSpan(verseText, target, cursor);
    if (!matched) {
      continue;
    }
    const start = matched.start;
    const end = matched.end;
    const code: 1 | 2 = seg.kind === "divine" ? 1 : 2;
    const last = tuples[tuples.length - 1];
    if (last && start < last[1]) {
      continue;
    }
    tuples.push([start, end, code]);
    cursor = end;
  }
  return tuples.length ? JSON.stringify(tuples) : "";
}

function parseChapterModelOutput(
  chapterInput: VerseRow[],
  modelObject: Record<string, unknown>,
): Map<number, string> {
  const verseTextByNo = new Map<number, string>();
  for (const row of chapterInput) verseTextByNo.set(row.verse, row.text);

  const verseObj = modelObject.verses;
  if (!verseObj || typeof verseObj !== "object" || Array.isArray(verseObj)) {
    throw new Error("模型 JSON 缺少 verses 对象");
  }

  const out = new Map<number, string>();
  for (const [verseKey, rows] of Object.entries(verseObj as Record<string, unknown>)) {
    const verse = Number(verseKey);
    if (!Number.isInteger(verse)) continue;
    const verseText = verseTextByNo.get(verse);
    if (!verseText) continue;
    if (!Array.isArray(rows)) continue;
    const segs: Array<{ kind: SpeechKind; text: string }> = [];
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const kind = toSpeechKind((row as Record<string, unknown>).kind);
      const text = String((row as Record<string, unknown>).text ?? "").trim();
      if (!kind || !text) continue;
      segs.push({ kind, text });
    }
    const spans = encodeSpansFromSegments(verseText, segs);
    if (spans) out.set(verse, spans);
  }
  return out;
}

function parseLineModelOutput(
  chapterInput: VerseRow[],
  text: string,
): Map<number, string> {
  const byVerse = new Map<number, Array<{ kind: SpeechKind; text: string }>>();
  const verseSet = new Set(chapterInput.map((v) => v.verse));
  const parseVerseToken = (raw: string): number | null => {
    const token = String(raw ?? "").trim();
    if (!token) return null;
    if (/^\d+$/.test(token)) return Number(token);
    const parts = token.split(":");
    const tail = parts[parts.length - 1]?.trim() || "";
    if (/^\d+$/.test(tail)) return Number(tail);
    return null;
  };
  const normalizedText = text
    .replace(/\\t/g, "\t")
    .replace(
      /\s+(?=\d+\t(?:divine|human|神|人|人物|耶稣|耶穌|上帝|天父)\t)/gi,
      "\n",
    );
  const lines = normalizedText
    .replace(/^```[\s\S]*?\n?/g, "")
    .replace(/```$/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const compact = line
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    let verse: number | null = null;
    let kind: SpeechKind | null = null;
    let segText = "";

    const cols = compact.split("\t");
    if (cols.length >= 3) {
      verse = parseVerseToken(cols[0] ?? "");
      kind = toSpeechKind(cols[1]);
      segText = cols.slice(2).join("\t").trim();
    } else {
      const m = compact.match(
        /^(\d+)\s*(?:\||,|，|;|；|:|：|\s)\s*(divine|human|神|人|人物|耶稣|耶穌|上帝|天父)\s*(?:\||,|，|;|；|:|：|\s)\s*(.+)$/i,
      );
      if (m) {
        verse = parseVerseToken(m[1] ?? "");
        kind = toSpeechKind(m[2]);
        segText = String(m[3] ?? "").trim();
      }
    }

    if (!Number.isInteger(verse) || !verseSet.has(verse)) continue;
    if (!kind || !segText) continue;
    const bucket = byVerse.get(verse) ?? [];
    bucket.push({ kind, text: segText });
    byVerse.set(verse, bucket);
  }
  const out = new Map<number, string>();
  for (const row of chapterInput) {
    const segs = byVerse.get(row.verse) ?? [];
    const spans = encodeSpansFromSegments(row.text, segs);
    if (spans) out.set(row.verse, spans);
  }
  return out;
}

function readReviewStateJson(cwd: string): SpeechSpansReviewState {
  const abs = path.join(cwd, SPEECH_SPANS_REVIEW_STATE_REL_PATH);
  if (!fs.existsSync(abs)) {
    return {
      format: "askbible-speech-review-state-v1",
      updatedAt: new Date().toISOString(),
      chapterStatus: {},
      verseOverrides: {},
    };
  }
  const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as Partial<SpeechSpansReviewState>;
  if (raw.format !== "askbible-speech-review-state-v1") {
    throw new Error(`review state format 非预期：${raw.format ?? "unknown"}`);
  }
  return {
    format: "askbible-speech-review-state-v1",
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    chapterStatus: { ...(raw.chapterStatus ?? {}) },
    verseOverrides: { ...(raw.verseOverrides ?? {}) },
  };
}

function sortObjectKeys<T>(obj: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

function writeReviewStateJson(cwd: string, state: SpeechSpansReviewState): void {
  const abs = path.join(cwd, SPEECH_SPANS_REVIEW_STATE_REL_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const chapterStatus = sortObjectKeys(state.chapterStatus ?? {});
  const verseOverridesRaw = state.verseOverrides ?? {};
  const verseOverrides: Record<string, Record<string, string>> = {};
  for (const [translationId, byVerse] of Object.entries(verseOverridesRaw).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    verseOverrides[translationId] = sortObjectKeys(byVerse);
  }

  const out: SpeechSpansReviewState = {
    format: "askbible-speech-review-state-v1",
    updatedAt: new Date().toISOString(),
    chapterStatus,
    verseOverrides,
  };
  fs.writeFileSync(abs, `${JSON.stringify(out, null, 2)}\n`, "utf8");
}

function runBuildCommand(command: string): void {
  const result = spawnSync("npm", ["run", command], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error(`命令失败: npm run ${command}`);
  }
}

async function annotateOneChapter(
  settings: ResolvedAISettings,
  input: { translationId: string; bookId: string; chapter: number; verses: VerseRow[] },
  timeoutMs: number,
  maxRetry: number,
): Promise<Map<number, string>> {
  const system = speechPromptSystem();
  const user = speechPromptUser(input);
  let lastErr = "unknown";
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const res = await createChatCompletion(
      settings,
      messages,
      { timeoutMs, maxTokens: 2600 },
    );
    if ("error" in res) {
      lastErr = res.error;
      messages.push({
        role: "user",
        content: `上一次请求失败：${lastErr}\n请重试，并且只输出合法 JSON。`,
      });
      continue;
    }
    try {
      const lineParsed = parseLineModelOutput(input.verses, res.text);
      if (lineParsed.size > 0) return lineParsed;
      lastErr = "模型未返回可解析的行格式标注";
      console.error(
        `[speech-ai] parse-preview ${input.translationId} ${input.bookId} ${input.chapter} -> ${res.text
          .replace(/\s+/g, " ")
          .slice(0, 220)}`,
      );
      messages.push({
        role: "assistant",
        content: res.text.slice(0, 1600),
      });
      messages.push({
        role: "user",
        content:
          "请按每行 `<verse>\\t<divine|human>\\t<原文子串>` 输出，至少返回一行可匹配片段；不要输出 JSON，不要解释。",
      });
      continue;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      messages.push({
        role: "assistant",
        content: res.text.slice(0, 1600),
      });
      messages.push({
        role: "user",
        content: `你的输出无法解析（${lastErr}）。请只输出 TSV 行：<verse>\\t<divine|human>\\t<原文子串>。`,
      });
    }
  }
  throw new Error(lastErr || "AI 标注失败");
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const settings = parseSettings(cwd);
  const translationIds = parseTranslations();
  const delayMs = readEnvInt("SPEECH_SPANS_AI_DELAY_MS", 220);
  const timeoutMs = readEnvInt("SPEECH_SPANS_AI_TIMEOUT_MS", 120000);
  const maxRetry = Math.max(1, readEnvInt("SPEECH_SPANS_AI_MAX_RETRY", 2));
  const dryRun = String(process.env.SPEECH_SPANS_AI_DRY_RUN ?? "") === "1";
  const applyBuild = String(process.env.SPEECH_SPANS_AI_APPLY_BUILD ?? "1") !== "0";
  const syncMobile = String(process.env.SPEECH_SPANS_AI_SYNC_MOBILE ?? "1") !== "0";
  const failedOnly = String(process.env.SPEECH_SPANS_AI_FAILED_ONLY ?? "0") === "1";

  const state = readReviewStateJson(cwd);
  state.chapterStatus = state.chapterStatus ?? {};
  state.verseOverrides = state.verseOverrides ?? {};

  let totalChapters = 0;
  let okChapters = 0;
  let failedChapters = 0;
  let updatedVerses = 0;

  for (const translationId of translationIds) {
    const books = readTranslationBooks(cwd, translationId);
    const chapters = findGospelChapters(books);
    totalChapters += chapters.length;
    if (!state.verseOverrides[translationId]) state.verseOverrides[translationId] = {};
    const targetOverrides = state.verseOverrides[translationId]!;

    for (const ch of chapters) {
      const chapterLabel = `${translationId} ${ch.bookId} ${ch.chapter}`;
      const chapterStatusKey = `${translationId}:${ch.bookId}:${ch.chapter}`;
      if (failedOnly && state.chapterStatus?.[chapterStatusKey] !== "needs-fix") {
        continue;
      }
      try {
        const spansByVerse = await annotateOneChapter(
          settings,
          {
            translationId,
            bookId: ch.bookId,
            chapter: ch.chapter,
            verses: ch.verses,
          },
          timeoutMs,
          maxRetry,
        );

        for (const row of ch.verses) {
          const verseKey = `${ch.bookId}:${ch.chapter}:${row.verse}`;
          delete targetOverrides[verseKey];
        }
        for (const [verse, spans] of spansByVerse.entries()) {
          const verseKey = `${ch.bookId}:${ch.chapter}:${verse}`;
          targetOverrides[verseKey] = spans;
          updatedVerses++;
        }

        state.chapterStatus[chapterStatusKey] = "reviewed" as SpeechReviewChapterStatus;
        okChapters++;
        console.error(`[speech-ai] ok ${chapterLabel} -> verses=${spansByVerse.size}`);
      } catch (e) {
        failedChapters++;
        const msg = e instanceof Error ? e.message : String(e);
        state.chapterStatus[chapterStatusKey] = "needs-fix" as SpeechReviewChapterStatus;
        console.error(`[speech-ai] fail ${chapterLabel} -> ${msg}`);
      }
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!dryRun) {
    writeReviewStateJson(cwd, state);
    console.error(`[speech-ai] wrote ${SPEECH_SPANS_REVIEW_STATE_REL_PATH}`);
    if (applyBuild) {
      runBuildCommand("build:speech-spans-v2");
      runBuildCommand("build:bible-sqlite");
      if (syncMobile) runBuildCommand("mobile:sync-scripture");
    }
  }

  console.error(
    `[speech-ai] done chapters=${totalChapters}, ok=${okChapters}, failed=${failedChapters}, updatedVerses=${updatedVerses}, dryRun=${dryRun ? 1 : 0}`,
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
