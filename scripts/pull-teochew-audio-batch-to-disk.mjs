#!/usr/bin/env node
/**
 * DEPRECATED: AskBible 不再托管潮语新约音频（不落 public/、不落 DATA_ROOT）。
 * App / Web 只引用 manifest 里的 TSTSCC remoteUrl。
 * 若仍要本机镜像（例如生成 timing），设 FORCE_TEOCHEW_LOCAL_MIRROR=1。
 */
if (process.env.FORCE_TEOCHEW_LOCAL_MIRROR !== "1") {
  console.error(
    "Refusing: teochew-nt is external-only (TSTSCC). Set FORCE_TEOCHEW_LOCAL_MIRROR=1 to override.",
  );
  process.exit(1);
}

/**
 * 从 TSTSCC（manifest remoteUrl）或 GitHub 分支分批下载潮语 MP3 到 DATA_ROOT/audio/teochew-nt。
 *
 *   DATA_ROOT=/var/data TEOCHEW_AUDIO_BATCH_INDEX=0 npm run audio:teochew-pull-batch
 *   DATA_ROOT=/var/data npm run audio:teochew-pull-all-batches
 *
 * 源选择：
 *   默认 TSTSCC（manifest.entries[].remoteUrl）
 *   TEOCHEW_AUDIO_SOURCE=github  → raw.githubusercontent.com/{repo}/{branch}/public/audio/teochew-nt/
 */
import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";

const cwd = process.cwd();
const manifestPath = path.join(cwd, "data", "bible", "teochew-nt-audio-manifest.json");
const batchSize = Math.max(1, Number(process.env.TEOCHEW_AUDIO_BATCH_SIZE || 40));
const batchIndex = Math.max(0, Number(process.env.TEOCHEW_AUDIO_BATCH_INDEX || 0));
const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();
const source = (process.env.TEOCHEW_AUDIO_SOURCE || "tstscc").trim().toLowerCase();
const repo = process.env.SELAH_GITHUB_REPO?.trim() || "askbibleme/askbibleme";
const branch = process.env.TEOCHEW_AUDIO_GIT_REF?.trim() || "teochew-nt-audio";
const token = process.env.GITHUB_TOKEN?.trim();

if (!root) {
  console.error("Set DATA_ROOT (e.g. DATA_ROOT=/var/data)");
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}`);
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

const destDir = path.join(root, "audio", "teochew-nt");
fs.mkdirSync(destDir, { recursive: true });

function urlForEntry(entry) {
  if (source === "github") {
    const name = entry.localFilename;
    return `https://raw.githubusercontent.com/${repo}/${branch}/public/audio/teochew-nt/${encodeURIComponent(name)}`;
  }
  return entry.remoteUrl;
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const headers = token && url.includes("github.com") ? { Authorization: `Bearer ${token}` } : {};
    const lib = url.startsWith("https:") ? https : http;
    lib
      .get(url, { headers }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error(`Redirect without location for ${url}`));
            return;
          }
          downloadFile(loc).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
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
    const url = urlForEntry(entry);
    const buf = await downloadFile(url);
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
  `Batch ${batchIndex + 1}/${totalBatches} (${source}): ${downloaded} downloaded, ${skipped} skipped, ${failed} failed → ${destDir}`,
);
if (failed > 0) process.exit(1);
if (batchIndex + 1 < totalBatches) {
  console.log(
    `Next: DATA_ROOT=${root} TEOCHEW_AUDIO_BATCH_INDEX=${batchIndex + 1} npm run audio:teochew-pull-batch`,
  );
}
