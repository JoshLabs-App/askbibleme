#!/usr/bin/env node
/**
 * 将 public/audio/*.mp3 同步到 Render 持久盘（或其它 DATA_ROOT）。
 *
 * MP3 不在 main 构建产物里，需先有音源目录：
 *   npm run audio:restore          # 从 cuv-chapter-audio 分支检出到 public/audio
 *   DATA_ROOT=/var/data npm run audio:sync-disk
 *
 * 或指定源目录：CUV_AUDIO_SRC=/path/to/mp3 DATA_ROOT=/var/data npm run audio:sync-disk
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const src = process.env.CUV_AUDIO_SRC?.trim()
  ? path.resolve(process.env.CUV_AUDIO_SRC.trim())
  : path.join(cwd, "public", "audio");
const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();

if (!root) {
  console.error("Set DATA_ROOT or CUV_AUDIO_DATA_DIR (e.g. DATA_ROOT=/var/data)");
  process.exit(1);
}

function countChapterMp3(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => /^[A-Z0-9]{2,8}-\d+\.mp3$/i.test(n)).length;
  } catch {
    return 0;
  }
}

let mp3Count = countChapterMp3(src);
if (mp3Count === 0 && process.env.CUV_AUDIO_AUTO_RESTORE === "1") {
  console.log("No MP3s in source; running npm run audio:restore …");
  execSync("npm run audio:restore", { stdio: "inherit", cwd });
  mp3Count = countChapterMp3(src);
}

if (mp3Count === 0) {
  console.error(
    [
      `No chapter MP3s found in: ${src}`,
      "",
      "Main deploy does not include public/audio (~900MB). First restore from git, then sync:",
      "  npm run audio:restore",
      "  DATA_ROOT=/var/data npm run audio:sync-disk",
      "",
      "Or one step on Render shell:",
      "  DATA_ROOT=/var/data npm run audio:deploy-disk",
    ].join("\n"),
  );
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

console.log(`Synced ${mp3Count} files from ${src} → ${dest}: ${copied} copied, ${skipped} unchanged.`);
