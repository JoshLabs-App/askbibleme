import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { getScriptureDatabase } from "@/lib/bible/scripture-sqlite-db";
import type { ParsedVerseKey } from "@/lib/bible/parse-verse-key";

const execFileAsync = promisify(execFile);

const DEFAULT_COUNT = 10;
const DEFAULT_SCOPE = "explore-curated-700";
const DEFAULT_TRANSLATION_ID = "cuv-simp";
const DEFAULT_VOICE = "cedar";
const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_SPEED = 0.94;
const DEFAULT_OUT_DIR = path.join("tmp", "audio-samples", "production-voice-cedar");
const DEFAULT_CONCURRENCY = 1;
const MAX_ATTEMPTS = 4;
const DEFAULT_ZH_INSTRUCTIONS =
  "Use a calm, deep, mature male voice with standard Mandarin pronunciation and no regional accent. Read slightly slower than normal, steady and quiet, with clear authority and a natural, unhurried cadence. Separate the scripture text and the reference clearly.";
const DEFAULT_EN_INSTRUCTIONS =
  "Use a calm, deep, mature male voice with clear, neutral English pronunciation and no strong regional accent. Read slightly slower than normal, steady and quiet, with gentle authority and a natural, unhurried cadence. Separate the scripture text and the reference clearly.";

type SpeechResponse = Response;

function parseArgs(argv: string[]): {
  count: number;
  outDir: string;
  scope: string;
  translationId: string;
  voice: string;
  model: string;
  speed: number;
  concurrency: number;
  overwrite: boolean;
  verseKeys: string[];
} {
  const out = {
    count: DEFAULT_COUNT,
    outDir: DEFAULT_OUT_DIR,
    scope: DEFAULT_SCOPE,
    translationId: DEFAULT_TRANSLATION_ID,
    voice: DEFAULT_VOICE,
    model: DEFAULT_MODEL,
    speed: DEFAULT_SPEED,
    concurrency: DEFAULT_CONCURRENCY,
    overwrite: true,
    verseKeys: [] as string[],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === "--count" && next) {
      out.count = Math.max(1, Number.parseInt(next, 10) || DEFAULT_COUNT);
      i += 1;
      continue;
    }
    if (arg === "--out" && next) {
      out.outDir = next;
      i += 1;
      continue;
    }
    if (arg === "--scope" && next) {
      out.scope = next;
      i += 1;
      continue;
    }
    if (arg === "--translation" && next) {
      out.translationId = next;
      i += 1;
      continue;
    }
    if (arg === "--voice" && next) {
      out.voice = next;
      i += 1;
      continue;
    }
    if (arg === "--model" && next) {
      out.model = next;
      i += 1;
      continue;
    }
    if (arg === "--speed" && next) {
      out.speed = Number(next) || DEFAULT_SPEED;
      i += 1;
      continue;
    }
    if (arg === "--concurrency" && next) {
      out.concurrency = Math.max(1, Math.min(12, Number.parseInt(next, 10) || DEFAULT_CONCURRENCY));
      i += 1;
      continue;
    }
    if (arg === "--verses" && next) {
      out.verseKeys = next
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === "--no-overwrite") {
      out.overwrite = false;
    }
  }

  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadApiKey(cwd: string): string {
  const direct = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (direct) return direct;

  const localEnvPath = path.join(cwd, ".env.local");
  if (fs.existsSync(localEnvPath)) {
    const raw = fs.readFileSync(localEnvPath, "utf8");
    const m = raw.match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m?.[1]) {
      const v = m[1].trim().replace(/^["']|["']$/g, "");
      if (v) return v;
    }
  }

  throw new Error("Missing OPENAI_API_KEY. Source .env.local or export the key before running.");
}

function parseVerseKey(verseKey: string): ParsedVerseKey | null {
  const m = /^([A-Z0-9]{2,8})\.(\d+)\.(\d+)$/.exec(String(verseKey || "").trim().toUpperCase());
  if (!m) return null;
  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) return null;
  return { bookId: m[1]!, chapter, verse };
}

function verseKeyToFileStem(verseKey: string): string {
  const p = parseVerseKey(verseKey);
  if (!p) return verseKey.replace(/[^A-Z0-9]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${p.bookId}-${p.chapter}-${p.verse}`;
}

function isEnglishTranslation(translationId: string): boolean {
  return translationId.trim().toLowerCase() === "web-en";
}

function verseLabel(
  bookId: string,
  chapter: number,
  verse: number,
  translationId: string,
): string {
  if (isEnglishTranslation(translationId)) {
    return `${getScriptureBookDisplayName(bookId, "en")} ${chapter}:${verse}`;
  }
  const book = scriptureBooks.find((b) => b.bookId === bookId);
  const bookName = book?.bookName ?? bookId;
  return `${bookName} ${chapter}章${verse}节`;
}

function speechInstructions(translationId: string): string {
  return isEnglishTranslation(translationId)
    ? DEFAULT_EN_INSTRUCTIONS
    : DEFAULT_ZH_INSTRUCTIONS;
}

async function openaiSpeech(opts: {
  apiKey: string;
  model: string;
  voice: string;
  input: string;
  speed: number;
  instructions: string;
}): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      voice: opts.voice,
      input: opts.input,
      instructions: opts.instructions,
      format: "wav",
      speed: opts.speed,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI speech failed (${res.status}): ${text || res.statusText}`);
  }

  const bytes = await res.arrayBuffer();
  return Buffer.from(bytes);
}

async function openaiSpeechWithRetry(opts: Parameters<typeof openaiSpeech>[0]): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await openaiSpeech(opts);
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS) break;
      await sleep(1_500 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function transcodeTo32kbpsMp3(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "32k",
    "-ac",
    "1",
    "-ar",
    "24000",
    outputPath,
  ]);
}

async function readVerseText(
  cwd: string,
  translationId: string,
  verseKey: string,
): Promise<{ bookId: string; chapter: number; verse: number; text: string } | null> {
  const p = parseVerseKey(verseKey);
  if (!p) return null;
  const db = await getScriptureDatabase(cwd, translationId);
  if (!db) return null;
  const stmt = db.prepare(
    "SELECT text FROM verse WHERE book_id = ? AND chapter = ? AND verse = ? LIMIT 1",
  );
  try {
    stmt.bind([p.bookId, p.chapter, p.verse]);
    if (!stmt.step()) return null;
    const row = stmt.getAsObject() as Record<string, unknown>;
    const text = String(row.text ?? "").trim();
    if (!text) return null;
    return { bookId: p.bookId, chapter: p.chapter, verse: p.verse, text };
  } finally {
    stmt.free();
  }
}

async function loadScopeVerseKeys(cwd: string, scope: string): Promise<string[]> {
  const manifestPath = path.join(
    cwd,
    "public",
    "data",
    "home-prayer-pools",
    scope,
    "manifest.json",
  );
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8")) as {
      entries?: { verseKey?: string }[];
    };
    const keys = (manifest.entries ?? [])
      .map((entry) => String(entry.verseKey ?? "").trim().toUpperCase())
      .filter(Boolean);
    if (keys.length) return keys;
  }

  const metaPath = path.join(cwd, "data", "scripture", `${scope}-meta.json`);
  const meta = JSON.parse(await fsp.readFile(metaPath, "utf8")) as { verseKeys?: string[] };
  return (meta.verseKeys ?? []).map((key) => String(key).trim().toUpperCase()).filter(Boolean);
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const opts = parseArgs(process.argv);
  const apiKey = loadApiKey(cwd);
  const scopeVerseKeys = opts.verseKeys.length
    ? opts.verseKeys
    : await loadScopeVerseKeys(cwd, opts.scope);
  const verseKeys = scopeVerseKeys.slice(0, opts.count);
  if (!verseKeys.length) throw new Error(`No verse keys found for scope ${opts.scope}`);

  await fsp.mkdir(opts.outDir, { recursive: true });

  const outputs: { verseKey: string; file: string }[] = [];
  const failures: { verseKey: string; error: string }[] = [];
  let cursor = 0;
  let completed = 0;

  const generateAt = async (i: number): Promise<void> => {
    const verseKey = verseKeys[i]!;
    const stem = verseKeyToFileStem(verseKey);
    const mp3Path = path.join(opts.outDir, `${stem}-32kbps.mp3`);
    if (!opts.overwrite && fs.existsSync(mp3Path)) {
      completed += 1;
      console.log(
        `[${String(completed).padStart(4, "0")}/${String(verseKeys.length).padStart(4, "0")}] skip ${verseKey}`,
      );
      return;
    }

    const verse = await readVerseText(cwd, opts.translationId, verseKey);
    if (!verse) {
      throw new Error(`Unable to load verse text for ${verseKey} from ${opts.translationId}`);
    }

    const prompt = `${verse.text} ${verseLabel(
      verse.bookId,
      verse.chapter,
      verse.verse,
      opts.translationId,
    )}${isEnglishTranslation(opts.translationId) ? "." : "。"}`;
    const wav = await openaiSpeechWithRetry({
      apiKey,
      model: opts.model,
      voice: opts.voice,
      input: prompt,
      speed: opts.speed,
      instructions: speechInstructions(opts.translationId),
    });

    const wavPath = path.join(opts.outDir, `${stem}.tmp.wav`);
    await fsp.writeFile(wavPath, wav);
    try {
      await transcodeTo32kbpsMp3(wavPath, mp3Path);
    } finally {
      await fsp.unlink(wavPath).catch(() => undefined);
    }

    outputs.push({ verseKey, file: mp3Path });
    completed += 1;
    console.log(
      `[${String(completed).padStart(4, "0")}/${String(verseKeys.length).padStart(4, "0")}] ${verseKey} -> ${mp3Path}`,
    );
  };

  const worker = async (): Promise<void> => {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= verseKeys.length) return;
      const verseKey = verseKeys[i]!;
      try {
        await generateAt(i);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ verseKey, error: message });
        completed += 1;
        console.error(
          `[${String(completed).padStart(4, "0")}/${String(verseKeys.length).padStart(4, "0")}] failed ${verseKey}: ${message}`,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: opts.concurrency }, () => worker()));

  if (failures.length) {
    const failurePath = path.join(opts.outDir, "generation-failures.json");
    await fsp.writeFile(failurePath, `${JSON.stringify(failures, null, 2)}\n`);
    throw new Error(`${failures.length} verses failed; see ${failurePath}`);
  }

  console.log("");
  console.log("Done:");
  for (const item of outputs) console.log(`${item.verseKey} ${item.file}`);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
