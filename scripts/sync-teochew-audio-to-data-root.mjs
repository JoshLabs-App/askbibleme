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
 * 将 public/audio/teochew-nt/*.mp3 同步到 Render 持久盘（或其它 DATA_ROOT）。
 *
 *   DATA_ROOT=/var/data npm run audio:teochew-sync-disk
 *
 * 或指定源目录：
 *   TEOCHEW_AUDIO_SRC=/path/to/mp3 DATA_ROOT=/var/data npm run audio:teochew-sync-disk
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const src = process.env.TEOCHEW_AUDIO_SRC?.trim()
  ? path.resolve(process.env.TEOCHEW_AUDIO_SRC.trim())
  : path.join(cwd, "public", "audio", "teochew-nt");
const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();

if (!root) {
  console.error("Set DATA_ROOT or CUV_AUDIO_DATA_DIR (e.g. DATA_ROOT=/var/data)");
  process.exit(1);
}

function countMp3(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => /^[A-Z0-9]{2,8}-\d+\.mp3$/i.test(n)).length;
  } catch {
    return 0;
  }
}

const mp3Count = countMp3(src);
if (mp3Count === 0) {
  console.error(
    [
      `No Teochew NT MP3s in: ${src}`,
      "",
      "Download locally first:",
      "  npm run audio:teochew-pull",
      "",
      "Or on Render shell (no upload from laptop):",
      "  DATA_ROOT=/var/data npm run audio:teochew-pull-all-batches",
    ].join("\n"),
  );
  process.exit(1);
}

const dest = path.join(root, "audio", "teochew-nt");
fs.mkdirSync(dest, { recursive: true });

let copied = 0;
let skipped = 0;
for (const name of fs.readdirSync(src)) {
  if (!/^[A-Z0-9]{2,8}-\d+\.mp3$/i.test(name)) continue;
  const from = path.join(src, name);
  const to = path.join(dest, name);
  if (!fs.statSync(from).isFile()) continue;
  const srcStat = fs.statSync(from);
  try {
    const destStat = fs.statSync(to);
    if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
      skipped += 1;
      continue;
    }
  } catch {
    /* copy */
  }
  fs.copyFileSync(from, to);
  copied += 1;
}

console.log(`Synced ${mp3Count} files from ${src} → ${dest}: ${copied} copied, ${skipped} unchanged.`);
