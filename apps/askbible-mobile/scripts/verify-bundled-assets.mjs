#!/usr/bin/env node
/**
 * EAS 云端构建前校验：离线媒体必须已在 apps/askbible-mobile/assets。
 * 由 package.json `eas-build-post-install` 调用。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(appRoot, "assets");

function mustExist(rel, label) {
  const fp = path.join(assets, rel);
  if (!fs.existsSync(fp)) {
    console.error(`[verify-bundled-assets] MISSING ${label}: ${rel}`);
    return false;
  }
  return true;
}

function dirFileCount(rel, ext) {
  const dir = path.join(assets, rel);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((n) => n.endsWith(ext)).length;
}

function fileMb(rel) {
  const fp = path.join(assets, rel);
  if (!fs.existsSync(fp)) return 0;
  return fs.statSync(fp).size / (1024 * 1024);
}

let ok = true;
ok = mustExist("music/tracks/track-mpg4a7xcip5q.mp3", "starter 音乐") && ok;
ok = mustExist("scripture/cuv-simp.sqlite", "和合本简体") && ok;
ok = mustExist("content/music-companion.json", "音乐目录") && ok;
ok = mustExist("content/nature-settings.json", "自然场景配置") && ok;
ok = mustExist("audio/scenes/scene-waves-ocean.mp3", "环境音") && ok;

const videoCount = dirFileCount("nature/videos", ".mp4");
if (videoCount < 1) {
  console.error(`[verify-bundled-assets] MISSING 自然场景视频 (found ${videoCount} mp4)`);
  ok = false;
}

const musicMb = fileMb("music/tracks/track-mpg4a7xcip5q.mp3");
const bibleMb = fileMb("scripture/cuv-simp.sqlite");
console.log(
  `[verify-bundled-assets] starter music ${musicMb.toFixed(1)} MB, cuv-simp ${bibleMb.toFixed(1)} MB, nature videos ${videoCount}`,
);

if (!ok) {
  console.error(
    "[verify-bundled-assets] 离线资源缺失。请在仓库根目录执行 npm run mobile:sync-content && MOBILE_BUNDLE_OFFLINE_MEDIA=1 npm run mobile:sync-offline-media 后重新构建。",
  );
  process.exit(1);
}

console.log("[verify-bundled-assets] OK");
