#!/usr/bin/env node
/**
 * 将 public/audio/*.mp3 同步到 Render 持久盘（或其它 DATA_ROOT）。
 * 在 Render Shell 或本机（挂载了同路径时）执行：
 *   DATA_ROOT=/var/data node scripts/sync-cuv-audio-to-data-root.mjs
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const src = path.join(cwd, "public", "audio");
const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();

if (!root) {
  console.error("Set DATA_ROOT or CUV_AUDIO_DATA_DIR (e.g. DATA_ROOT=/var/data)");
  process.exit(1);
}

const dest = path.join(root, "audio");
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

console.log(`Synced to ${dest}: ${copied} copied, ${skipped} unchanged.`);
