#!/usr/bin/env node
/**
 * YouVersion / API.Bible 音频章朗读 + 同章逐节正文 → stable-ts 对齐 → public/verse-timings/{translationId}/
 *
 * 生成目标：
 * - NIV  → public/verse-timings/niv/
 * - NLT  → public/verse-timings/nlt/
 * - NKJV → public/verse-timings/nkjv/
 *
 * 说明：
 * - 音频从 Bible.com 的 audio-bible 页面解析。
 * - 经文正文从现有译本加载器读取（YouVersion / API.Bible）。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scriptureBooks } from "../lib/bible/scripture-books";
import { loadChapterFromTranslation } from "../lib/bible/load-chapter-from-default-translation";
import { resolveYouVersionChapterAudioPlayableSrc } from "../lib/bible/youversion-chapter-audio";
import { loadYouVersionChapterRowsFromPage } from "../lib/bible/youversion-chapter-page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const WHISPER_SCRIPT = path.join(__dirname, "whisper-verse-align.py");
const OUT_ROOT = path.join(cwd, "public", "verse-timings");
const TARGET_TRANSLATIONS = new Set(["niv", "nlt", "nkjv"]);

function resolveWhisperPython() {
  const explicit = process.env.SELAH_WHISPER_PYTHON?.trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  const localCandidates = [
    path.join(__dirname, "whisper-env", "bin", "python"),
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
    path.join(askRoot, "scripts", "whisper-env", "bin", "python"),
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

function outputPath(translationId: string, bookId: string, chapter: number): string {
  return path.join(OUT_ROOT, translationId, `${bookId}-${chapter}.json`);
}

function audioTmpPath(translationId: string, bookId: string, chapter: number, tmpDir: string): string {
  return path.join(tmpDir, `${translationId}-${bookId}-${chapter}.mp3`);
}

async function download(url: string, target: string): Promise<void> {
  const lastErrors: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      fs.rmSync(target, { force: true });
      const res = await fetch(url, {
        headers: {
          "User-Agent": "AskBible.me verse timing generator",
        },
      });
      if (!res.ok || !res.body) {
        throw new Error(`download failed: ${res.status} ${res.statusText}`);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(target, bytes);
      if (!fs.existsSync(target) || fs.statSync(target).size < 10_000) {
        throw new Error("downloaded audio too small");
      }
      return;
    } catch (err) {
      lastErrors.push(err instanceof Error ? err.message : String(err));
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error(lastErrors[lastErrors.length - 1] ?? "download failed");
}

function versesPayloadFromChapter(chapter: Awaited<ReturnType<typeof loadChapterFromTranslation>>) {
  if (!chapter?.verses?.length) return null;
  return chapter.verses
    .map((v) => ({
      verse: v.verse,
      text: String(v.text || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((v) => v.text);
}

function validateTimings(
  timings: Array<{ verse: number; start: number; end: number }>,
  verses: Array<{ verse: number; text: string }>,
): void {
  if (timings.length !== verses.length) {
    throw new Error(`timings ${timings.length} !== verses ${verses.length}`);
  }
  let lastStart = -1;
  for (let i = 0; i < timings.length; i += 1) {
    const t = timings[i]!;
    const v = verses[i]!;
    if (t.verse !== v.verse) {
      throw new Error(`verse mismatch at ${i}: ${t.verse} !== ${v.verse}`);
    }
    if (!Number.isFinite(t.start) || !Number.isFinite(t.end) || t.start < 0 || t.end < t.start) {
      throw new Error(`invalid timing at verse ${t.verse}`);
    }
    if (t.start < lastStart) {
      throw new Error(`non-monotonic start at verse ${t.verse}`);
    }
    lastStart = t.start;
  }
}

async function alignChapter(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  model: string;
  force: boolean;
  tmpDir: string;
}): Promise<void> {
  const out = outputPath(args.translationId, args.bookId, args.chapter);
  if (!args.force && fs.existsSync(out)) {
    console.log(`  [skip] ${args.translationId} ${args.bookId} ${args.chapter}`);
    return;
  }

  const chapterData = await loadChapterFromTranslation(cwd, args.bookId, args.chapter, args.translationId);
  let verses = versesPayloadFromChapter(chapterData);
  if (!verses?.length) {
    verses = await loadYouVersionChapterRowsFromPage({
      translationId: args.translationId,
      bookId: args.bookId,
      chapter: args.chapter,
    });
  }
  if (!verses?.length) {
    throw new Error(`no verses for ${args.translationId} ${args.bookId} ${args.chapter}`);
  }

  const audio = await resolveYouVersionChapterAudioPlayableSrc({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
  });
  if (!audio.ok) {
    throw new Error(`no audio for ${args.translationId} ${args.bookId} ${args.chapter}`);
  }

  const audioPath = audioTmpPath(args.translationId, args.bookId, args.chapter, args.tmpDir);
  await download(audio.src, audioPath);

  const versesJson = path.join(args.tmpDir, `${args.translationId}-${args.bookId}-${args.chapter}-verses.json`);
  fs.writeFileSync(versesJson, `${JSON.stringify(verses, null, 2)}\n`, "utf8");

  const stdout = await new Promise<string>((resolve, reject) => {
    const proc = spawn(VENV_PYTHON, [WHISPER_SCRIPT, audioPath, versesJson, "--model", args.model, "--language", "en"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += String(d)));
    proc.stderr.on("data", (d) => {
      err += String(d);
      process.stderr.write(d);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`whisper exit ${code}: ${err}`));
    });
  });

  const timings = JSON.parse(stdout) as Array<{ verse: number; start: number; end: number }>;
  validateTimings(timings, verses);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(timings, null, 2)}\n`, "utf8");
  console.log(`  [done] ${path.relative(cwd, out)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const translation = (args.find((_, i) => args[i - 1] === "--translation") ?? "niv").trim().toLowerCase();
  const book = (args.find((_, i) => args[i - 1] === "--book") ?? "").trim().toUpperCase();
  const chapter = Number(args.find((_, i) => args[i - 1] === "--chapter") ?? 0);
  const all = args.includes("--all");
  const force = args.includes("--force");
  const continueOnError = args.includes("--continue-on-error");
  const model = (args.find((_, i) => args[i - 1] === "--model") ?? "small").trim();
  const delayArg = args.find((a) => a.startsWith("--delay="));
  const delayMs = delayArg ? Math.max(0, Number(delayArg.split("=")[1]) || 0) : 500;
  return { translation, book, chapter, all, force, continueOnError, model, delayMs };
}

async function main(): Promise<number> {
  const args = parseArgs();
  if (!TARGET_TRANSLATIONS.has(args.translation)) {
    console.error(`translation must be one of: ${Array.from(TARGET_TRANSLATIONS).join(", ")}`);
    return 1;
  }

  let jobs = scriptureBooks.flatMap((book) =>
    Array.from({ length: book.chapters }, (_, idx) => ({ bookId: book.bookId, chapter: idx + 1 })),
  );
  if (args.book) jobs = jobs.filter((job) => job.bookId === args.book);
  if (!args.all && Number.isInteger(args.chapter) && args.chapter > 0) {
    jobs = jobs.filter((job) => job.bookId === args.book && job.chapter === args.chapter);
  }
  if (!args.all && !args.book && !Number.isInteger(args.chapter)) {
    console.log(`Usage:
  npm run audio:youversion-timings -- --translation niv --book GEN --chapter 1 [--model small] [--force]
  npm run audio:youversion-timings -- --translation niv --all [--continue-on-error] [--delay=500]
`);
    return 0;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "askbible-youversion-whisper-"));
  console.log(`YouVersion timings → ${path.join(OUT_ROOT, args.translation)}`);
  console.log(`Whisper: ${VENV_PYTHON}`);
  console.log(`Jobs: ${jobs.length}`);

  let ok = 0;
  let fail = 0;
  try {
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i]!;
      console.log(`[${i + 1}/${jobs.length}] ${args.translation} ${job.bookId} ${job.chapter}`);
      try {
        await alignChapter({
          translationId: args.translation,
          bookId: job.bookId,
          chapter: job.chapter,
          model: args.model,
          force: args.force,
          tmpDir,
        });
        ok += 1;
      } catch (err) {
        fail += 1;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [error] ${msg}`);
        if (!args.continueOnError) {
          break;
        }
      }
      if (args.delayMs > 0 && i < jobs.length - 1) {
        await sleep(args.delayMs);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`Finished: ok=${ok}, failed=${fail}`);
  return fail > 0 ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
