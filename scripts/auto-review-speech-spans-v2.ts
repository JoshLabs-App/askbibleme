import fs from "node:fs";
import { loadSpeechSpansSnapshot } from "../lib/bible/speech-spans-snapshot";
import {
  SPEECH_SPANS_REVIEW_STATE_REL_PATH,
  speechSpansReviewStatePath,
  type SpeechReviewChapterStatus,
  type SpeechSpansReviewState,
} from "../lib/bible/speech-spans-review-state";

type ChapterStats = {
  annotatedVerses: number;
  divineVerses: number;
  humanVerses: number;
  mixedVerses: number;
  shortSpanVerses: number;
};

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

function decideStatus(stats: ChapterStats): SpeechReviewChapterStatus {
  // 自动分级：风险明显的章节标 needs-fix，其余先标 reviewed。
  if (stats.mixedVerses >= 3) return "needs-fix";
  if (stats.shortSpanVerses >= 3) return "needs-fix";
  if (stats.humanVerses >= 20 && stats.mixedVerses >= 1) return "needs-fix";
  return "reviewed";
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const snapshot = loadSpeechSpansSnapshot(cwd, "latest");
  if (!snapshot) {
    console.error("[auto-review-speech-spans-v2] missing snapshot, run build:speech-spans-v1 first.");
    process.exit(1);
  }

  const chapterStatsByKey = new Map<string, ChapterStats>();
  for (const [translationId, verseMap] of snapshot.translations.entries()) {
    for (const [verseKey, spans] of verseMap.entries()) {
      const parsed = parseVerseKey(verseKey);
      if (!parsed) continue;
      const codes = parseSpeechCodes(spans);
      if (!codes.divineCount && !codes.humanCount) continue;
      const chapterKey = `${translationId}:${parsed.bookId}:${parsed.chapter}`;
      const stats = chapterStatsByKey.get(chapterKey) ?? {
        annotatedVerses: 0,
        divineVerses: 0,
        humanVerses: 0,
        mixedVerses: 0,
        shortSpanVerses: 0,
      };
      stats.annotatedVerses++;
      if (codes.divineCount > 0) stats.divineVerses++;
      if (codes.humanCount > 0) stats.humanVerses++;
      if (codes.divineCount > 0 && codes.humanCount > 0) stats.mixedVerses++;
      if (codes.minSpanLen <= 3) stats.shortSpanVerses++;
      chapterStatsByKey.set(chapterKey, stats);
    }
  }

  const chapterStatus: Record<string, SpeechReviewChapterStatus> = {};
  let reviewedCount = 0;
  let needsFixCount = 0;
  for (const [chapterKey, stats] of chapterStatsByKey.entries()) {
    const status = decideStatus(stats);
    chapterStatus[chapterKey] = status;
    if (status === "needs-fix") needsFixCount++;
    else reviewedCount++;
  }

  const out: SpeechSpansReviewState = {
    format: "askbible-speech-review-state-v1",
    updatedAt: new Date().toISOString(),
    chapterStatus,
    verseOverrides: {},
  };
  const outPath = speechSpansReviewStatePath(cwd);
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.error(
    `[auto-review-speech-spans-v2] snapshot=${snapshot.version}, chapters=${chapterStatsByKey.size}, reviewed=${reviewedCount}, needs-fix=${needsFixCount} -> ${SPEECH_SPANS_REVIEW_STATE_REL_PATH}`,
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
