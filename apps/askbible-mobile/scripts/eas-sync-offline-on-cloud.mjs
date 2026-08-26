#!/usr/bin/env node
/**
 * EAS 云端构建：归档已含离线媒体时仅校验；缺失时才尝试 sync（需根目录 data/public 真源）。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const assets = path.join(appRoot, "assets");

function run(cmd, env = {}) {
  execSync(cmd, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

function assetsReadyForBundle() {
  const checks = [
    "music/tracks/track-mt391okyjj4i.mp3",
    "scripture/cuv-simp.sqlite",
    "content/music-companion.json",
    "audio/scenes/scene-waves-ocean.mp3",
  ];
  for (const rel of checks) {
    if (!fs.existsSync(path.join(assets, rel))) return false;
  }
  const musicTracks = path.join(assets, "music/tracks");
  const musicCount = fs.existsSync(musicTracks)
    ? fs.readdirSync(musicTracks).filter((n) => /\.(mp3|m4a)$/i.test(n)).length
    : 0;
  if (musicCount < 4) return false;
  const natureVideos = path.join(assets, "nature/videos");
  if (!fs.existsSync(natureVideos)) return false;
  const mp4Count = fs.readdirSync(natureVideos).filter((n) => n.endsWith(".mp4")).length;
  if (mp4Count < 1) return false;

  let bytes = 0;
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else bytes += st.size;
    }
  };
  walk(assets);
  return bytes >= 50 * 1024 * 1024;
}

if (assetsReadyForBundle()) {
  console.log("[eas-sync-offline-on-cloud] 归档已含离线媒体，跳过云端 sync");
  process.exit(0);
}

if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
  console.error("[eas-sync-offline-on-cloud] 缺少仓库根 package.json，无法 sync。");
  process.exit(1);
}

console.log("[eas-sync-offline-on-cloud] 离线媒体不完整，尝试从真源 sync…");
console.log("[eas-sync-offline-on-cloud] → sync-mobile-content");
run("node scripts/sync-mobile-content.mjs");

console.log("[eas-sync-offline-on-cloud] → sync-mobile-offline-media");
run("node scripts/sync-mobile-offline-media.mjs", {
  MOBILE_BUNDLE_OFFLINE_MEDIA: "1",
  MOBILE_STARTER_MUSIC_TRACK_ID: "track-mt391okyjj4i",
});

console.log("[eas-sync-offline-on-cloud] done");
