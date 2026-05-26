import fs from "node:fs";
import path from "node:path";
import { loadSpeechSpansSnapshot, type LoadedSpeechSpansSnapshot } from "../lib/bible/speech-spans-snapshot";
import {
  loadSpeechSpansReviewState,
  type SpeechReviewChapterStatus,
} from "../lib/bible/speech-spans-review-state";
import { readTranslationsIndex, resolveTranslationAbsolutePath } from "../lib/bible/translations-store";

const OUTPUT_REL_PATH = "data/bible/annotations/speech-spans-review-queue.md";
const GOSPELS = new Set(["MAT", "MRK", "LUK", "JHN"]);

type VerseRisk = {
  bookId: string;
  chapter: number;
  verse: number;
  divineCount: number;
  humanCount: number;
  minSpanLen: number;
  text: string;
};

type ChapterRisk = {
  translationId: string;
  bookId: string;
  chapter: number;
  totalAnnotatedVerses: number;
  divineVerses: number;
  humanVerses: number;
  mixedVerses: number;
  shortSpanVerses: number;
  score: number;
  sampleRefs: string[];
  status: SpeechReviewChapterStatus;
};

type ChapterAccumulator = {
  totalAnnotatedVerses: number;
  divineVerses: number;
  humanVerses: number;
  mixedVerses: number;
  shortSpanVerses: number;
  sampleRefs: string[];
};

function pushSampleRefUnique(bucket: string[], ref: string): void {
  if (bucket.length >= 3) return;
  if (bucket.includes(ref)) return;
  bucket.push(ref);
}

function parseVerseKey(key: string): { bookId: string; chapter: number; verse: number } | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  const bookId = String(parts[0] || "").trim().toUpperCase();
  const chapter = Number(parts[1]);
  const verse = Number(parts[2]);
  if (!bookId || !Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1) {
    return null;
  }
  return { bookId, chapter, verse };
}

function parseSpeechCodes(raw: string): { divineCount: number; humanCount: number; minSpanLen: number } {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return { divineCount: 0, humanCount: 0, minSpanLen: Number.POSITIVE_INFINITY };
    let divineCount = 0;
    let humanCount = 0;
    let minSpanLen = Number.POSITIVE_INFINITY;
    for (const row of arr) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const start = Number(row[0]);
      const end = Number(row[1]);
      const code = Number(row[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) continue;
      const len = end - start;
      if (len < minSpanLen) minSpanLen = len;
      if (code === 1) divineCount++;
      if (code === 2) humanCount++;
    }
    return { divineCount, humanCount, minSpanLen };
  } catch {
    return { divineCount: 0, humanCount: 0, minSpanLen: Number.POSITIVE_INFINITY };
  }
}

function chapterRef(bookId: string, chapter: number): string {
  return `${bookId} ${chapter}`;
}

function buildMarkdownReport(
  snapshot: LoadedSpeechSpansSnapshot,
  topGospels: ChapterRisk[],
  topOthers: ChapterRisk[],
  verseSamples: VerseRisk[],
): string {
  const lines: string[] = [];
  lines.push("# Speech Spans v1 Review Queue");
  lines.push("");
  lines.push(`Snapshot: ${snapshot.relPath}`);
  lines.push(`Snapshot version: ${snapshot.version}`);
  lines.push(`Snapshot generated at: ${snapshot.generatedAt || "-"}`);
  lines.push("");
  lines.push("Status legend: `todo` | `reviewed` | `needs-fix`");
  lines.push("Chapter status key format in review-state: `<translationId>:<BOOK>:<chapter>`");
  lines.push("");
  lines.push("## Priority A - Gospel Chapters");
  lines.push("");
  if (!topGospels.length) {
    lines.push("- (none)");
  } else {
    for (const row of topGospels) {
      lines.push(
        `- [${row.status}] ${row.translationId} ${chapterRef(row.bookId, row.chapter)} | score=${row.score} | annotated=${row.totalAnnotatedVerses} divine=${row.divineVerses} human=${row.humanVerses} mixed=${row.mixedVerses} short=${row.shortSpanVerses} | samples=${row.sampleRefs.join(", ") || "-"}`,
      );
    }
  }
  lines.push("");
  lines.push("## Priority B - Other High-Risk Chapters");
  lines.push("");
  if (!topOthers.length) {
    lines.push("- (none)");
  } else {
    for (const row of topOthers) {
      lines.push(
        `- [${row.status}] ${row.translationId} ${chapterRef(row.bookId, row.chapter)} | score=${row.score} | annotated=${row.totalAnnotatedVerses} divine=${row.divineVerses} human=${row.humanVerses} mixed=${row.mixedVerses} short=${row.shortSpanVerses} | samples=${row.sampleRefs.join(", ") || "-"}`,
      );
    }
  }
  lines.push("");
  lines.push("## Spot-check Verses (Mixed/Short)");
  lines.push("");
  if (!verseSamples.length) {
    lines.push("- (none)");
  } else {
    for (const v of verseSamples) {
      lines.push(
        `- ${v.bookId} ${v.chapter}:${v.verse} | divineSpans=${v.divineCount} humanSpans=${v.humanCount} minSpanLen=${v.minSpanLen} | ${v.text}`,
      );
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const snapshot = loadSpeechSpansSnapshot(cwd, "latest");
  if (!snapshot) {
    console.error(
      "[build-speech-spans-review-queue] missing speech snapshot, run build:speech-spans-v1 first.",
    );
    process.exit(1);
  }
  const reviewState = loadSpeechSpansReviewState(cwd);
  const index = await readTranslationsIndex(cwd);
  const chapterMap = new Map<string, ChapterAccumulator>();
  const verseSamples: VerseRisk[] = [];

  for (const tr of index.translations) {
    const translationId = String(tr.id || "").trim();
    if (!translationId) continue;
    const translationSnapshot = snapshot.translations.get(translationId);
    if (!translationSnapshot) continue;

    const abs = resolveTranslationAbsolutePath(cwd, translationId);
    if (!fs.existsSync(abs)) continue;
    const source = JSON.parse(fs.readFileSync(abs, "utf8")) as {
      books?: Record<string, Record<string, Record<string, string>>>;
    };
    const books = source.books ?? {};

    for (const [verseKey, speechSpans] of translationSnapshot.entries()) {
      const parsed = parseVerseKey(verseKey);
      if (!parsed) continue;
      const codes = parseSpeechCodes(speechSpans);
      if (!codes.divineCount && !codes.humanCount) continue;

      const chapterKey = `${translationId}:${parsed.bookId}:${parsed.chapter}`;
      const acc = chapterMap.get(chapterKey) ?? {
        totalAnnotatedVerses: 0,
        divineVerses: 0,
        humanVerses: 0,
        mixedVerses: 0,
        shortSpanVerses: 0,
        sampleRefs: [],
      };
      acc.totalAnnotatedVerses++;
      if (codes.divineCount > 0) acc.divineVerses++;
      if (codes.humanCount > 0) acc.humanVerses++;
      if (codes.divineCount > 0 && codes.humanCount > 0) {
        acc.mixedVerses++;
        pushSampleRefUnique(acc.sampleRefs, `${parsed.bookId} ${parsed.chapter}:${parsed.verse}`);
      }
      if (codes.minSpanLen <= 3) {
        acc.shortSpanVerses++;
        pushSampleRefUnique(acc.sampleRefs, `${parsed.bookId} ${parsed.chapter}:${parsed.verse}`);
      }
      chapterMap.set(chapterKey, acc);

      if ((codes.divineCount > 0 && codes.humanCount > 0) || codes.minSpanLen <= 3) {
        const text =
          books?.[parsed.bookId]?.[String(parsed.chapter)]?.[String(parsed.verse)]?.trim() ?? "";
        verseSamples.push({
          ...parsed,
          divineCount: codes.divineCount,
          humanCount: codes.humanCount,
          minSpanLen: Number.isFinite(codes.minSpanLen) ? codes.minSpanLen : -1,
          text,
        });
      }
    }
  }

  const chapterRisks: ChapterRisk[] = [];
  for (const [chapterKey, acc] of chapterMap.entries()) {
    const [translationId, bookId, chapterStr] = chapterKey.split(":");
    const chapter = Number(chapterStr);
    const score =
      acc.totalAnnotatedVerses +
      acc.humanVerses * 2 +
      acc.mixedVerses * 5 +
      acc.shortSpanVerses * 2 +
      (GOSPELS.has(bookId) ? 20 : 0);
    chapterRisks.push({
      translationId,
      bookId,
      chapter,
      totalAnnotatedVerses: acc.totalAnnotatedVerses,
      divineVerses: acc.divineVerses,
      humanVerses: acc.humanVerses,
      mixedVerses: acc.mixedVerses,
      shortSpanVerses: acc.shortSpanVerses,
      score,
      sampleRefs: acc.sampleRefs,
      status: reviewState?.chapterStatus.get(`${translationId}:${bookId}:${chapter}`) ?? "todo",
    });
  }

  const topGospels = chapterRisks
    .filter((row) => GOSPELS.has(row.bookId))
    .sort((a, b) => b.score - a.score || a.translationId.localeCompare(b.translationId))
    .slice(0, 80);
  const topOthers = chapterRisks
    .filter((row) => !GOSPELS.has(row.bookId))
    .sort((a, b) => b.score - a.score || a.translationId.localeCompare(b.translationId))
    .slice(0, 80);
  const topVerseSamples = verseSamples
    .sort((a, b) => a.minSpanLen - b.minSpanLen || b.humanCount + b.divineCount - (a.humanCount + a.divineCount))
    .slice(0, 120);

  const report = buildMarkdownReport(snapshot, topGospels, topOthers, topVerseSamples);
  const outPath = path.join(cwd, OUTPUT_REL_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, "utf8");
  console.error(
    `[build-speech-spans-review-queue] wrote ${OUTPUT_REL_PATH} (gospel=${topGospels.length}, others=${topOthers.length}, verseSamples=${topVerseSamples.length})`,
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
