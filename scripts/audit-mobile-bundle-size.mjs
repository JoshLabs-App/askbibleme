#!/usr/bin/env node
/**
 * 构建前审计 apps/askbible-mobile/assets 体积。
 * 音乐默认每专辑首曲进包（≥4）；全量 / PAD 由环境变量打开。
 * TEMP：非首曲走 Cloudflare R2（见 musicAudioRemote.ts）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(repoRoot, "apps", "askbible-mobile", "assets");
const androidMusicPad =
  process.env.MOBILE_ANDROID_MUSIC_PAD === "1" ||
  process.env.MOBILE_ANDROID_MUSIC_PAD === "true";
const bundleMusicFull =
  process.env.MOBILE_BUNDLE_MUSIC_FULL === "1" ||
  process.env.MOBILE_BUNDLE_MUSIC_FULL === "true";
const padAssetsDir = path.join(
  repoRoot,
  "apps",
  "askbible-mobile",
  "android",
  "music_companion_pack",
  "src",
  "main",
  "assets",
  "music",
  "tracks",
);

/** companion 全量音乐约数百 MB；starter-only 约数十 MB。 */
const MUSIC_TRACK_WARN_MB = bundleMusicFull ? 600 : androidMusicPad ? 120 : 160;
const ASSETS_WARN_MB = bundleMusicFull ? 700 : androidMusicPad ? 400 : 450;
const ASSETS_MIN_MB = 20;
/** 默认 ≥4 专辑首曲；全量 ≥10。 */
const MUSIC_TRACK_MIN_COUNT = bundleMusicFull ? 10 : 4;

function dirBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    total += st.isDirectory() ? dirBytes(fp) : st.size;
  }
  return total;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      out.push(...listFiles(fp));
      continue;
    }
    out.push({ rel: path.relative(assetsRoot, fp), bytes: st.size });
  }
  return out;
}

function mb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

const buckets = [
  ["music/tracks", "音乐曲目"],
  ["music/analysis", "音乐分析 JSON"],
  ["nature/videos", "自然场景视频"],
  ["nature/posters", "自然场景海报"],
  ["audio/scenes", "场景环境音"],
  ["audio/web-en", "章朗读 web-en"],
  ["audio/teochew-nt", "章朗读 teochew-nt"],
  ["audio/cuv-v20", "章朗读 cuv-v20"],
  ["audio/cuv", "章朗读 cuv"],
  ["audio/blm-es", "章朗读 blm-es"],
  ["scripture", "译本 sqlite"],
  ["content", "文案与导读 JSON"],
  ["images", "图片"],
  ["bible", "圣经索引"],
];

console.log("Mobile bundle size audit (apps/askbible-mobile/assets)\n");

let total = 0;
const rows = [];
for (const [rel, label] of buckets) {
  const bytes = dirBytes(path.join(assetsRoot, rel));
  total += bytes;
  if (bytes > 0) rows.push({ label, rel, bytes });
}

for (const row of rows.sort((a, b) => b.bytes - a.bytes)) {
  const fileCount =
    row.rel === "music/tracks"
      ? fs.existsSync(path.join(assetsRoot, row.rel))
        ? fs.readdirSync(path.join(assetsRoot, row.rel)).length
        : 0
      : null;
  const extra = fileCount != null ? ` (${fileCount} file(s))` : "";
  console.log(`  ${row.label.padEnd(16)} ${mb(row.bytes).padStart(6)} MB  ${row.rel}${extra}`);
}

const topFiles = listFiles(assetsRoot)
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 8);
if (topFiles.length > 0) {
  console.log("\nLargest files:");
  for (const f of topFiles) {
    console.log(`  ${mb(f.bytes).padStart(6)} MB  ${f.rel}`);
  }
}

console.log(`\nTotal assets: ${mb(total)} MB`);
console.log(
  `Expected install (assets + native): ~${mb(total + 30 * 1024 * 1024)}–${mb(total + 80 * 1024 * 1024)} MB`,
);
console.log(
  androidMusicPad
    ? "Music policy: Android PAD — album starters in base; rest in music_companion_pack (fast-follow).\n"
    : bundleMusicFull
      ? "Music policy: full companion catalog bundled.\n"
      : "Music policy: album starters in install; rest → Cloudflare R2 stream/cache (TEMPORARY).\n",
);

let failed = false;
const musicTracks = dirBytes(path.join(assetsRoot, "music/tracks"));
const musicCount = fs.existsSync(path.join(assetsRoot, "music/tracks"))
  ? fs.readdirSync(path.join(assetsRoot, "music/tracks")).filter((n) => /\.(mp3|m4a)$/i.test(n))
      .length
  : 0;
const padMusicCount = fs.existsSync(padAssetsDir)
  ? fs.readdirSync(padAssetsDir).filter((n) => /\.(mp3|m4a)$/i.test(n)).length
  : 0;
const padMusicBytes = dirBytes(padAssetsDir);

if (musicCount < MUSIC_TRACK_MIN_COUNT) {
  console.error(
    `ERROR: expected ≥${MUSIC_TRACK_MIN_COUNT} album-starter tracks in assets, found ${musicCount}. Run npm run mobile:sync-offline-media`,
  );
  failed = true;
}
if (androidMusicPad && padMusicCount < 1) {
  console.error(
    "ERROR: Android PAD enabled but music_companion_pack has no tracks. Run MOBILE_ANDROID_MUSIC_PAD=1 npm run mobile:sync-offline-media",
  );
  failed = true;
}
if (androidMusicPad) {
  console.log(
    `PAD pack tracks: ${padMusicCount} file(s), ${mb(padMusicBytes)} MB (not in base assets total above)`,
  );
}
if (musicTracks > MUSIC_TRACK_WARN_MB * 1024 * 1024) {
  console.warn(
    `WARN: bundled music is ${mb(musicTracks)} MB (${musicCount} file(s)) — review before store submit.`,
  );
}

for (const [rel, label] of [
  ["audio/web-en", "章朗读"],
  ["audio/teochew-nt", "章朗读"],
  ["audio/cuv-v20", "章朗读"],
  ["audio/cuv", "章朗读"],
  ["audio/blm-es", "章朗读"],
]) {
  const bytes = dirBytes(path.join(assetsRoot, rel));
  if (bytes > 0) {
    console.error(`ERROR: ${label} bundled at ${rel} (${mb(bytes)} MB) — should not ship in AAB.`);
    failed = true;
  }
}

if (total < ASSETS_MIN_MB * 1024 * 1024) {
  console.error(
    `ERROR: total assets ${mb(total)} MB < ${ASSETS_MIN_MB} MB — 离线媒体未同步。运行 mobile:sync-content + mobile:sync-offline-media。`,
  );
  failed = true;
}

if (total > ASSETS_WARN_MB * 1024 * 1024) {
  console.warn(`WARN: total assets ${mb(total)} MB exceeds ${ASSETS_WARN_MB} MB — review before submitting to Play.`);
}

if (failed) process.exit(1);
console.log("Audit passed.");
