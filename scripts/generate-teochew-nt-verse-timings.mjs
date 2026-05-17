#!/usr/bin/env node
/**
 * 潮州语新约整章 MP3 + 和合本（cuv-simp）逐节正文 → stable-ts 对齐 → verse-timings JSON。
 *
 * 需 Python 环境（stable-ts），默认复用 AskBible 2 的 scripts/whisper-env：
 *   ASKBIBLE_REPO=~/Desktop/APP/01\ AskBible\ 2
 *
 * Usage:
 *   npm run audio:teochew-timings -- --book MAT --chapter 1 [--model small] [--force]
 *   npm run audio:teochew-timings -- --all [--continue-on-error] [--delay=500]
 *   npm run audio:teochew-timings -- --book MAT --all
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

const MANIFEST_PATH = path.join(cwd, "data", "bible", "teochew-nt-audio-manifest.json");
const CUV_JSON = path.join(cwd, "data", "bible", "uploads", "cuv-simp.json");
const WHISPER_SCRIPT = path.join(__dirname, "whisper-verse-align.py");
const TIMINGS_DIR = path.join(cwd, "public", "verse-timings", "teochew-nt");

function resolveWhisperPython() {
  const explicit = process.env.SELAH_WHISPER_PYTHON?.trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  const localCandidates = [
    path.join(__dirname, "whisper-env", "bin", "python3.14"),
    path.join(__dirname, "whisper-env", "bin", "python3.13"),
    path.join(__dirname, "whisper-env", "bin", "python3.12"),
    path.join(__dirname, "whisper-env", "bin", "python3"),
  ];
  for (const p of localCandidates) {
    if (fs.existsSync(p)) return p;
  }

  const askRoot =
    process.env.ASKBIBLE_REPO?.trim() ||
    path.join(process.env.HOME || "", "Desktop", "APP", "01 AskBible 2");
  const askCandidates = [
    path.join(askRoot, "scripts", "whisper-env", "bin", "python3.14"),
    path.join(askRoot, "scripts", "whisper-env", "bin", "python3.13"),
    path.join(askRoot, "scripts", "whisper-env", "bin", "python3.12"),
    path.join(askRoot, "scripts", "whisper-env", "bin", "python3"),
  ];
  for (const p of askCandidates) {
    if (fs.existsSync(p)) return p;
  }

  return askCandidates[askCandidates.length - 1];
}

const VENV_PYTHON = resolveWhisperPython();

function resolveTeochewAudioPath(localFilename) {
  const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();
  const candidates = [
    path.join(cwd, "public", "audio", "teochew-nt", localFilename),
  ];
  if (root) candidates.push(path.join(root, "audio", "teochew-nt", localFilename));
  for (const p of candidates) {
    try {
      if (fs.statSync(p).isFile() && fs.statSync(p).size > 1000) return p;
    } catch {
      /* next */
    }
  }
  return null;
}

function loadCuvVerses(bookId, chapter) {
  if (!fs.existsSync(CUV_JSON)) {
    throw new Error(`Missing ${CUV_JSON}`);
  }
  const raw = JSON.parse(fs.readFileSync(CUV_JSON, "utf8"));
  const chMap = raw.books?.[bookId]?.[String(chapter)];
  if (!chMap || typeof chMap !== "object") {
    throw new Error(`No CUV verses for ${bookId} ${chapter}`);
  }
  return Object.keys(chMap)
    .map((k) => ({ verse: Number(k), text: String(chMap[k] || "").replace(/\s+/g, " ").trim() }))
    .filter((v) => Number.isInteger(v.verse) && v.verse >= 1 && v.text)
    .sort((a, b) => a.verse - b.verse);
}

async function alignChapter(entry, model, tmpDir, force) {
  const { bookId, chapter, localFilename } = entry;
  const outPath = path.join(TIMINGS_DIR, localFilename.replace(/\.mp3$/i, ".json"));
  if (!force && fs.existsSync(outPath)) {
    console.log(`  [skip] ${bookId}-${chapter} timing exists`);
    return;
  }

  const audioFile = resolveTeochewAudioPath(localFilename);
  if (!audioFile) {
    throw new Error(`MP3 missing: ${localFilename} (run npm run audio:teochew-pull)`);
  }

  console.log(`  [verses] ${bookId} ${chapter} from cuv-simp…`);
  const verses = loadCuvVerses(bookId, chapter);
  if (!verses.length) throw new Error(`empty verses ${bookId} ${chapter}`);

  const versesFile = path.join(tmpDir, `${bookId}-${chapter}-verses.json`);
  fs.writeFileSync(versesFile, JSON.stringify(verses, null, 2));

  if (!fs.existsSync(VENV_PYTHON)) {
    throw new Error(
      `Whisper Python not found at ${VENV_PYTHON}. Create scripts/whisper-env or set ASKBIBLE_REPO / SELAH_WHISPER_PYTHON.`,
    );
  }

  console.log(`  [whisper] ${path.basename(audioFile)} model=${model}…`);
  const stdout = await new Promise((resolve, reject) => {
    const proc = spawn(VENV_PYTHON, [WHISPER_SCRIPT, audioFile, versesFile, "--model", model]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => {
      out += d;
    });
    proc.stderr.on("data", (d) => {
      err += d;
      process.stderr.write(d);
    });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`Whisper exit ${code}: ${err}`));
      else resolve(out);
    });
  });

  const timings = JSON.parse(stdout);
  fs.mkdirSync(TIMINGS_DIR, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(timings, null, 2)}\n`, "utf8");
  console.log(`  [done] ${outPath} (${timings.length} verses)`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const args = process.argv.slice(2);
const bookArg = args.find((_, i) => args[i - 1] === "--book");
const chapterArg = args.find((_, i) => args[i - 1] === "--chapter");
const modelArg = args.find((_, i) => args[i - 1] === "--model") || "small";
const doAll = args.includes("--all");
const force = args.includes("--force");
const continueOnError = args.includes("--continue-on-error");
const delayEq = args.find((a) => a.startsWith("--delay="));
const delayMs = delayEq ? Math.max(0, Number(delayEq.split("=")[1]) || 0) : 500;

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`Missing ${MANIFEST_PATH}. Run npm run audio:teochew-manifest`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
let entries = Array.isArray(manifest.entries) ? manifest.entries : [];

if (bookArg) {
  const id = String(bookArg).trim().toUpperCase();
  entries = entries.filter((e) => e.bookId === id);
  if (chapterArg && !doAll) {
    const ch = Number(chapterArg);
    entries = entries.filter((e) => e.chapter === ch);
  }
}

if (entries.length === 0) {
  console.log("No manifest entries to process.");
  process.exit(0);
}

if (!bookArg && !doAll) {
  console.log(`Usage:
  npm run audio:teochew-timings -- --book MAT --chapter 1 [--model small] [--force]
  npm run audio:teochew-timings -- --book MAT --all
  npm run audio:teochew-timings -- --all [--continue-on-error] [--delay=500]
`);
  process.exit(0);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "selah-teochew-whisper-"));
let ok = 0;
let fail = 0;

try {
  console.log(`Teochew NT timings → ${TIMINGS_DIR}`);
  console.log(`Whisper: ${VENV_PYTHON}`);
  console.log(`Chapters: ${entries.length}\n`);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    console.log(`[${i + 1}/${entries.length}] ${e.bookId} ${e.chapter}`);
    try {
      await alignChapter(e, modelArg, tmpDir, force);
      ok++;
    } catch (err) {
      fail++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [error] ${msg}`);
      if (!continueOnError) {
        process.exitCode = 1;
        break;
      }
    }
    if (delayMs > 0 && i < entries.length - 1) await sleep(delayMs);
  }
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true });
  } catch {
    /* ignore */
  }
}

console.log(`\nFinished: ok=${ok}, failed=${fail}`);
if (fail > 0) process.exit(1);
