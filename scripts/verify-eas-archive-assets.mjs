#!/usr/bin/env node
/**
 * 构建前检查 EAS 归档是否包含离线 mp3/mp4/sqlite（防止打出空壳 IPA）。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = path.join(repoRoot, "apps", "askbible-mobile");
const platform = (process.env.EAS_ARCHIVE_PLATFORM || process.argv[2] || "ios").trim().toLowerCase();
if (platform !== "ios" && platform !== "android") {
  console.error(`ERROR: unsupported platform "${platform}" (use ios or android)`);
  process.exit(1);
}
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `eas-archive-check-${platform}-`));

console.log(`→ 生成 EAS 归档预览（${platform}）…`);
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
execSync(
  `npx eas build:inspect --platform ${platform} --stage archive --output "${outDir}" --force`,
  { cwd: mobileRoot, stdio: "inherit" },
);

const assetsRoot = path.join(outDir, "apps", "askbible-mobile", "assets");
function findUnder(ext) {
  if (!fs.existsSync(assetsRoot)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else if (name.endsWith(ext)) out.push(fp);
    }
  };
  walk(assetsRoot);
  return out;
}

const mp3 = findUnder(".mp3");
const mp4 = findUnder(".mp4");
const sqlite = findUnder(".sqlite");

console.log(`\nEAS archive assets: ${mp3.length} mp3, ${mp4.length} mp4, ${sqlite.length} sqlite`);

const minMp3 = 2; // 1 music + ≥1 scene ambient
const minMp4 = 1;
const minSqlite = 1;

let failed = false;
if (mp3.length < minMp3) {
  console.error(`ERROR: expected ≥${minMp3} mp3 in archive, got ${mp3.length}`);
  failed = true;
}
if (mp4.length < minMp4) {
  console.error(`ERROR: expected ≥${minMp4} mp4 in archive, got ${mp4.length}`);
  failed = true;
}
if (sqlite.length < minSqlite) {
  console.error(`ERROR: expected ≥${minSqlite} sqlite in archive, got ${sqlite.length}`);
  failed = true;
}

function dirBytes(root) {
  if (!fs.existsSync(root)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const fp = path.join(d, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else n += st.size;
    }
  };
  walk(root);
  return n;
}

const assetsMb = dirBytes(assetsRoot) / (1024 * 1024);
console.log(`Archive assets total: ${assetsMb.toFixed(1)} MB`);
if (assetsMb < 50) {
  console.error("ERROR: archive assets < 50 MB — 离线包过轻，媒体可能未进 EAS 上传。");
  failed = true;
}

fs.rmSync(outDir, { recursive: true, force: true });

if (failed) process.exit(1);
console.log("EAS archive asset check passed.\n");
