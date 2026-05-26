import fs from "node:fs";
import path from "node:path";
import { loadSpeechSpansReviewState, SPEECH_SPANS_REVIEW_STATE_REL_PATH } from "../lib/bible/speech-spans-review-state";
import {
  loadSpeechSpansSnapshot,
  SPEECH_SPANS_SNAPSHOT_V1_REL_PATH,
  SPEECH_SPANS_SNAPSHOT_V2_REL_PATH,
  speechSpansSnapshotPath,
  type SpeechSpansSnapshot,
} from "../lib/bible/speech-spans-snapshot";

function parseStoredSpeechSpans(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return false;
    for (const row of parsed) {
      if (!Array.isArray(row) || row.length < 3) return false;
      const start = Number(row[0]);
      const end = Number(row[1]);
      const code = Number(row[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return false;
      if (code !== 1 && code !== 2) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const base = loadSpeechSpansSnapshot(cwd, "v1");
  if (!base) {
    console.error(`[build-speech-spans-v2] missing base snapshot: ${SPEECH_SPANS_SNAPSHOT_V1_REL_PATH}`);
    process.exit(1);
  }

  const reviewState = loadSpeechSpansReviewState(cwd);
  if (!reviewState) {
    console.error(
      `[build-speech-spans-v2] missing review state: ${SPEECH_SPANS_REVIEW_STATE_REL_PATH}`,
    );
    process.exit(1);
  }

  const merged: Record<string, Record<string, string>> = {};
  for (const [translationId, byVerse] of base.translations.entries()) {
    merged[translationId] = Object.fromEntries(byVerse.entries());
  }

  let overrideApplied = 0;
  let overrideInvalid = 0;
  for (const [translationId, byVerse] of reviewState.verseOverrides.entries()) {
    if (!merged[translationId]) merged[translationId] = {};
    for (const [verseKey, spans] of byVerse.entries()) {
      if (!parseStoredSpeechSpans(spans)) {
        overrideInvalid++;
        continue;
      }
      merged[translationId]![verseKey] = spans;
      overrideApplied++;
    }
  }

  const snapshot: SpeechSpansSnapshot = {
    format: "askbible-speech-spans-v2",
    generatedAt: new Date().toISOString(),
    translations: merged,
  };

  const outPath = speechSpansSnapshotPath(cwd, "v2");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  const bytes = fs.statSync(outPath).size;
  console.error(
    `[build-speech-spans-v2] done -> ${SPEECH_SPANS_SNAPSHOT_V2_REL_PATH} (${bytes} bytes), overrides applied=${overrideApplied}, invalid=${overrideInvalid}`,
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
