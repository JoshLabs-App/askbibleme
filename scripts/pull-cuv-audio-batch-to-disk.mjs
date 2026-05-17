#!/usr/bin/env node
/**
 * 从 GitHub 分批下载 MP3 到 DATA_ROOT/audio（适合 Render Shell，无需 git remote）。
 *
 *   DATA_ROOT=/var/data CUV_AUDIO_BATCH_INDEX=0 npm run audio:pull-batch
 *   DATA_ROOT=/var/data CUV_AUDIO_BATCH_INDEX=1 npm run audio:pull-batch
 *   … 直到日志显示 batch 为空
 *
 * 私有仓库：在 Render 环境变量设置 GITHUB_TOKEN（repo 读权限）。
 */
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const cwd = process.cwd();
const repo = process.env.SELAH_GITHUB_REPO?.trim() || "askbibleme/askbibleme";
const branch = process.env.CUV_AUDIO_GIT_REF?.trim() || "cuv-chapter-audio";
const batchSize = Math.max(1, Number(process.env.CUV_AUDIO_BATCH_SIZE || 80));
const batchIndex = Math.max(0, Number(process.env.CUV_AUDIO_BATCH_INDEX || 0));
const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();
const token = process.env.GITHUB_TOKEN?.trim();

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

const destDir = path.join(root, "audio");
fs.mkdirSync(destDir, { recursive: true });

function rawUrl(filename) {
  return `https://raw.githubusercontent.com/${repo}/${branch}/public/audio/${encodeURIComponent(filename)}`;
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    https
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

for (const name of batch) {
  const dest = path.join(destDir, name);
  try {
    if (fs.existsSync(dest)) {
      const st = fs.statSync(dest);
      if (st.isFile() && st.size > 1024) {
        skipped += 1;
        continue;
      }
    }
    const buf = await downloadFile(rawUrl(name));
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
