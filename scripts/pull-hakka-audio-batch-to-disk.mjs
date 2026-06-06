#!/usr/bin/env node
/**
 * 分批下载客语 MP3 到 DATA_ROOT/audio/hakka（适合 Render Shell）。
 *
 *   DATA_ROOT=/var/data HAKKA_AUDIO_BATCH_INDEX=0 npm run audio:hakka-pull-batch
 *   DATA_ROOT=/var/data npm run audio:hakka-pull-all-batches
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const manifestPath = path.join(cwd, "data", "bible", "hakka-audio-manifest.json");
const batchSize = Math.max(1, Number(process.env.HAKKA_AUDIO_BATCH_SIZE || 40));
const batchIndex = Math.max(0, Number(process.env.HAKKA_AUDIO_BATCH_INDEX || 0));
const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();

if (!root) {
  console.error("Set DATA_ROOT (e.g. DATA_ROOT=/var/data)");
  process.exit(1);
}
if (!fs.existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}. Run: npm run audio:hakka-manifest`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const allEntries = Array.isArray(manifest.entries) ? manifest.entries : [];
const start = batchIndex * batchSize;
const batch = allEntries.slice(start, start + batchSize);

if (batch.length === 0) {
  console.log(`Batch ${batchIndex} empty (${allEntries.length} entries, size ${batchSize}). Done.`);
  process.exit(0);
}

const destDir = path.join(root, "audio", "hakka");
fs.mkdirSync(destDir, { recursive: true });

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "AskBibleHakkaBatchPull/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const entry of batch) {
  const name = entry.localFilename;
  const dest = path.join(destDir, name);
  try {
    if (fs.existsSync(dest)) {
      const st = fs.statSync(dest);
      if (st.isFile() && st.size > 1024) {
        skipped += 1;
        continue;
      }
    }
    const buf = await download(entry.remoteUrl);
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

const totalBatches = Math.ceil(allEntries.length / batchSize);
console.log(
  `Batch ${batchIndex + 1}/${totalBatches}: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed → ${destDir}`,
);
if (failed > 0) process.exit(1);
if (batchIndex + 1 < totalBatches) {
  console.log(`Next: DATA_ROOT=${root} HAKKA_AUDIO_BATCH_INDEX=${batchIndex + 1} npm run audio:hakka-pull-batch`);
}
