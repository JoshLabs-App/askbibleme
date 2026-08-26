#!/usr/bin/env node
/**
 * 确保首页金句间隔静音轨存在（release 打包前 sync 会清掉未白名单 mp3）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const audioDir = path.join(repoRoot, "apps", "askbible-mobile", "assets", "audio");

const FILES = [
  { name: "verse-gap-silence-7.mp3", seconds: 7 },
  { name: "background-silence-60.mp3", seconds: 60 },
];

function ensureWithFfmpeg(destAbs, seconds) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      String(seconds),
      "-c:a",
      "libmp3lame",
      "-b:a",
      "32k",
      destAbs,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "ffmpeg failed");
  }
}

fs.mkdirSync(audioDir, { recursive: true });
for (const file of FILES) {
  const destAbs = path.join(audioDir, file.name);
  if (fs.existsSync(destAbs) && fs.statSync(destAbs).size > 0) {
    console.log(`keep ${file.name}`);
    continue;
  }
  ensureWithFfmpeg(destAbs, file.seconds);
  console.log(`wrote ${file.name} (${file.seconds}s)`);
}
