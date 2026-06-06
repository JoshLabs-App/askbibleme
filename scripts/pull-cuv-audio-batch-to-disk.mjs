#!/usr/bin/env node
/**
 * 从 FHL（和合本 闫大卫朗读，version=20）分批下载 MP3 到 DATA_ROOT/audio。
 *
 *   DATA_ROOT=/var/data CUV_AUDIO_BATCH_INDEX=0 npm run audio:pull-batch
 *   DATA_ROOT=/var/data CUV_AUDIO_BATCH_INDEX=1 npm run audio:pull-batch
 *   … 直到日志显示 batch 为空
 *
 * 如需把已有文件全部更新到 version=20，可加：
 *   CUV_AUDIO_FORCE_OVERWRITE=1
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const batchSize = Math.max(1, Number(process.env.CUV_AUDIO_BATCH_SIZE || 80));
const batchIndex = Math.max(0, Number(process.env.CUV_AUDIO_BATCH_INDEX || 0));
const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();
const forceOverwrite = process.env.CUV_AUDIO_FORCE_OVERWRITE === "1";
const localSubdir = process.env.CUV_AUDIO_LOCAL_SUBDIR?.trim() || "cuv-v20";
const FHL_UNVDAVID_BASE = "https://media.fhl.net/unvdavid";
const BOOK_ORDER = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
  "MAT",
  "MRK",
  "LUK",
  "JHN",
  "ACT",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "PHP",
  "COL",
  "1TH",
  "2TH",
  "1TI",
  "2TI",
  "TIT",
  "PHM",
  "HEB",
  "JAS",
  "1PE",
  "2PE",
  "1JN",
  "2JN",
  "3JN",
  "JUD",
  "REV",
];
const BOOK_ID_TO_BID = new Map(BOOK_ORDER.map((bookId, index) => [bookId, index + 1]));

if (!root) {
  console.error("Set DATA_ROOT (e.g. DATA_ROOT=/var/data)");
  process.exit(1);
}

const manifestPath = path.join(cwd, "data", "bible", "cuv-chapter-audio-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}. Run from repo root after deploy.`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const allFiles = Array.isArray(manifest.files) ? manifest.files : [];
const start = batchIndex * batchSize;
const batch = allFiles.slice(start, start + batchSize);

if (batch.length === 0) {
  console.log(`Batch ${batchIndex} empty (${allFiles.length} files, size ${batchSize}). Done.`);
  process.exit(0);
}

const destDir = path.join(root, "audio", localSubdir);
fs.mkdirSync(destDir, { recursive: true });

function fhlAudioUrl(bookId, chapter) {
  const bid = BOOK_ID_TO_BID.get(bookId);
  if (!bid || !Number.isInteger(chapter) || chapter < 1) return null;
  const chap3 = String(chapter).padStart(3, "0");
  return `${FHL_UNVDAVID_BASE}/${bid}/${bid}_${chap3}.mp3`;
}

async function downloadFile(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "AskBibleCuvPull/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const name of batch) {
  const dest = path.join(destDir, name);
  try {
    if (!forceOverwrite && fs.existsSync(dest)) {
      const st = fs.statSync(dest);
      if (st.isFile() && st.size > 1024) {
        skipped += 1;
        continue;
      }
    }
    const m = /^([A-Z0-9]+)-(\d+)\.mp3$/.exec(name);
    if (!m) throw new Error(`invalid manifest filename: ${name}`);
    const bookId = m[1];
    const chapter = Number(m[2]);
    const remote = fhlAudioUrl(bookId, chapter);
    if (!remote) throw new Error(`cannot map ${bookId} to FHL bid`);
    const buf = await downloadFile(remote);
    if (buf.length < 1024) {
      throw new Error(`file too small (${buf.length} bytes)`);
    }
    fs.writeFileSync(dest, buf);
    downloaded += 1;
    process.stdout.write(`  ${name}\n`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

const totalBatches = Math.ceil(allFiles.length / batchSize);
console.log(
  `Batch ${batchIndex + 1}/${totalBatches}: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed → ${destDir}`,
);
if (failed > 0) process.exit(1);
if (batchIndex + 1 < totalBatches) {
  console.log(`Next: DATA_ROOT=${root} CUV_AUDIO_BATCH_INDEX=${batchIndex + 1} npm run audio:pull-batch`);
}
