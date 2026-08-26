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
ok = mustExist("music/tracks/track-mt391okyjj4i.mp3", "音乐曲目") && ok;
ok = mustExist("scripture/cuv-simp.sqlite", "和合本简体") && ok;
ok = mustExist("scripture/cuv-trad.sqlite", "和合本繁体") && ok;
ok = mustExist("scripture/web-en.sqlite", "WEB 英译本") && ok;
ok = mustExist("content/music-companion.json", "音乐目录") && ok;
ok = mustExist("content/nature-settings.json", "自然场景配置") && ok;
ok = mustExist("audio/scenes/scene-waves-ocean.mp3", "环境音") && ok;

const videoCount = dirFileCount("nature/videos", ".mp4");
if (videoCount < 1) {
  console.error(`[verify-bundled-assets] MISSING 自然场景视频 (found ${videoCount} mp4)`);
  ok = false;
}

const musicCount = dirFileCount("music/tracks", ".mp3") + dirFileCount("music/tracks", ".m4a");
if (musicCount < 4) {
  console.error(
    `[verify-bundled-assets] MISSING 专辑首曲音乐 (found ${musicCount}; expect ≥4 album starters)`,
  );
  ok = false;
}

const musicMb = fileMb("music/tracks/track-mt391okyjj4i.mp3");
const cuvSimpMb = fileMb("scripture/cuv-simp.sqlite");
const cuvTradMb = fileMb("scripture/cuv-trad.sqlite");
const webEnMb = fileMb("scripture/web-en.sqlite");
const kjvMb = fileMb("scripture/kjv.sqlite");
for (const [rel, label, minMb] of [
  ["scripture/cuv-simp.sqlite", "cuv-simp", 4],
  ["scripture/cuv-trad.sqlite", "cuv-trad", 4],
  ["scripture/web-en.sqlite", "web-en", 4],
  ["scripture/kjv.sqlite", "kjv", 4],
]) {
  const mb = fileMb(rel);
  if (mb < minMb) {
    console.error(`[verify-bundled-assets] ${label} too small (${mb.toFixed(2)} MB)`);
    ok = false;
  }
}
console.log(
  `[verify-bundled-assets] music tracks ${musicCount} (sample ${musicMb.toFixed(1)} MB), cuv-simp ${cuvSimpMb.toFixed(1)} MB, cuv-trad ${cuvTradMb.toFixed(1)} MB, web-en ${webEnMb.toFixed(1)} MB, kjv ${kjvMb.toFixed(1)} MB, nature videos ${videoCount}`,
);

if (!ok) {
  console.error(
    "[verify-bundled-assets] 离线资源缺失。请在仓库根目录执行 npm run mobile:sync-content && MOBILE_BUNDLE_OFFLINE_MEDIA=1 npm run mobile:sync-offline-media 后重新构建。",
  );
  process.exit(1);
}

console.log("[verify-bundled-assets] OK");
