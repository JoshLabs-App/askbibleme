import fs from "node:fs";
import path from "node:path";
import type { SpeechSpansReviewState } from "../lib/bible/speech-spans-review-state";

const REVIEW_STATE_REL_PATH = "data/bible/annotations/speech-spans-review-state-v1.json";
const GOSPELS = new Set(["MAT", "MRK", "LUK", "JHN"]);

function isGospelVerseKey(key: string): boolean {
  const parts = String(key || "").split(":");
  if (parts.length !== 3) return false;
  const bookId = String(parts[0] || "").trim().toUpperCase();
  return GOSPELS.has(bookId);
}

function isGospelChapterStatusKey(key: string): boolean {
  const parts = String(key || "").split(":");
  if (parts.length < 3) return false;
  const bookId = String(parts[1] || "").trim().toUpperCase();
  return GOSPELS.has(bookId);
}

function main(): void {
  const cwd = process.cwd();
  const abs = path.join(cwd, REVIEW_STATE_REL_PATH);
  if (!fs.existsSync(abs)) {
    throw new Error(`review-state not found: ${REVIEW_STATE_REL_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as SpeechSpansReviewState;
  if (raw.format !== "askbible-speech-review-state-v1") {
    throw new Error(`unexpected review-state format: ${String((raw as { format?: unknown }).format ?? "")}`);
  }

  const chapterStatus = { ...(raw.chapterStatus ?? {}) };
  const verseOverrides = { ...(raw.verseOverrides ?? {}) };

  let removedChapterStatus = 0;
  for (const key of Object.keys(chapterStatus)) {
    if (!key.startsWith("cuv-simp:")) continue;
    if (!isGospelChapterStatusKey(key)) continue;
    delete chapterStatus[key];
    removedChapterStatus++;
  }

  let removedVerseOverrides = 0;
  const cuvSimpOverrides = { ...(verseOverrides["cuv-simp"] ?? {}) };
  for (const key of Object.keys(cuvSimpOverrides)) {
    if (!isGospelVerseKey(key)) continue;
    delete cuvSimpOverrides[key];
    removedVerseOverrides++;
  }
  verseOverrides["cuv-simp"] = cuvSimpOverrides;

  const out: SpeechSpansReviewState = {
    format: "askbible-speech-review-state-v1",
    updatedAt: new Date().toISOString(),
    chapterStatus,
    verseOverrides,
  };
  fs.writeFileSync(abs, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.error(
    `[reset-gospel-speech-overrides] removed chapterStatus=${removedChapterStatus}, verseOverrides=${removedVerseOverrides}`,
  );
}

main();
