import fs from "node:fs";
import path from "node:path";
import { splitChapterVersesBySpeechHighlights, translationSupportsSpeechHighlight } from "../lib/bible/infer-divine-speech-spans";
import {
  encodeSpeechSpans,
  verseAnnotationKey,
  type StoredSpeechSpanTuple,
} from "../lib/bible/verse-annotations";
import {
  SPEECH_SPANS_SNAPSHOT_V1_REL_PATH,
  speechSpansSnapshotPath,
  type SpeechSpansSnapshot,
} from "../lib/bible/speech-spans-snapshot";
import { readTranslationsIndex, resolveTranslationAbsolutePath } from "../lib/bible/translations-store";
import { parseAndValidateBiblePayload } from "../lib/bible/validate-bible-json";

type TranslationStats = {
  totalVerses: number;
  annotatedVerses: number;
  divineTaggedVerses: number;
  humanTaggedVerses: number;
};

function parseStoredSpeechSpanTuples(raw: string): StoredSpeechSpanTuple[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: StoredSpeechSpanTuple[] = [];
    for (const row of parsed) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const start = Number(row[0]);
      const end = Number(row[1]);
      const code = Number(row[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) continue;
      if (code === 1 || code === 2) out.push([start, end, code]);
    }
    return out;
  } catch {
    return [];
  }
}

function emptyStats(): TranslationStats {
  return {
    totalVerses: 0,
    annotatedVerses: 0,
    divineTaggedVerses: 0,
    humanTaggedVerses: 0,
  };
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const index = await readTranslationsIndex(cwd);
  if (!index.translations.length) {
    console.error("[build-speech-spans-v1] translations.json 无译本，跳过。");
    return;
  }

  const snapshot: SpeechSpansSnapshot = {
    format: "askbible-speech-spans-v1",
    generatedAt: new Date().toISOString(),
    translations: {},
  };

  let totalVerses = 0;
  let annotatedVerses = 0;

  for (const tr of index.translations) {
    const translationId = String(tr.id || "").trim();
    if (!translationId) continue;
    if (!translationSupportsSpeechHighlight(translationId)) {
      console.error(`[build-speech-spans-v1] skip ${translationId}: unsupported translation.`);
      continue;
    }
    const abs = resolveTranslationAbsolutePath(cwd, translationId);
    if (!fs.existsSync(abs)) {
      console.error(`[build-speech-spans-v1] missing JSON: ${abs}`);
      process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
    const { books } = parseAndValidateBiblePayload(raw);
    const out: Record<string, string> = {};
    const stats = emptyStats();

    const bookIds = Object.keys(books).sort();
    for (const bookId of bookIds) {
      const chapters = books[bookId];
      if (!chapters || typeof chapters !== "object") continue;
      const chapterKeys = Object.keys(chapters).sort((a, b) => Number(a) - Number(b));
      for (const chKey of chapterKeys) {
        const chapter = Number(chKey);
        if (!Number.isInteger(chapter) || chapter < 1) continue;
        const versesObj = chapters[chKey];
        if (!versesObj || typeof versesObj !== "object") continue;
        const verseKeys = Object.keys(versesObj).sort((a, b) => Number(a) - Number(b));
        const verses = verseKeys
          .map((vKey) => {
            const verse = Number(vKey);
            const text = versesObj[vKey];
            if (!Number.isInteger(verse) || verse < 1 || typeof text !== "string" || !text.trim()) {
              return null;
            }
            return { verse, text };
          })
          .filter((row): row is { verse: number; text: string } => row != null);
        if (!verses.length) continue;

        const partsByVerse = splitChapterVersesBySpeechHighlights(verses, {
          translationId,
          bookId,
          chapter,
        });

        verses.forEach((v, idx) => {
          stats.totalVerses++;
          const speechSpans = encodeSpeechSpans(partsByVerse[idx] ?? []);
          if (!speechSpans) return;
          out[verseAnnotationKey(bookId, chapter, v.verse)] = speechSpans;
          stats.annotatedVerses++;
          const tuples = parseStoredSpeechSpanTuples(speechSpans);
          if (tuples.some((row) => row[2] === 1)) stats.divineTaggedVerses++;
          if (tuples.some((row) => row[2] === 2)) stats.humanTaggedVerses++;
        });
      }
    }

    snapshot.translations[translationId] = out;
    totalVerses += stats.totalVerses;
    annotatedVerses += stats.annotatedVerses;
    console.error(
      `[build-speech-spans-v1] ${translationId}: total=${stats.totalVerses}, annotated=${stats.annotatedVerses}, divine=${stats.divineTaggedVerses}, human=${stats.humanTaggedVerses}`,
    );
  }

  const outPath = speechSpansSnapshotPath(cwd, "v1");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  const bytes = fs.statSync(outPath).size;
  console.error(
    `[build-speech-spans-v1] done: ${totalVerses} verses, ${annotatedVerses} annotated -> ${SPEECH_SPANS_SNAPSHOT_V1_REL_PATH} (${bytes} bytes)`,
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
