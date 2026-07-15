#!/usr/bin/env node
/**
 * 将 public/verse-timings 合并为单文件，供 Release 包内章朗读跟读高亮（无网络）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "public", "verse-timings");
const dest = path.join(repoRoot, "apps", "askbible-mobile", "assets", "content", "verse-timings-bundle.json");

if (!fs.existsSync(srcRoot)) {
  console.error(`Missing ${srcRoot}`);
  process.exit(1);
}

/** @type {Record<string, Record<string, unknown>>} */
const bundle = {
  "cuv-v20": {},
  "cuv-simp": {},
  "web-en": {},
  kjv: {},
  "teochew-nt": {},
};

function ingestDir(scopeId, dir) {
  let count = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!/^[A-Z0-9]{2,8}-\d+\.json$/i.test(name)) continue;
    const key = name.slice(0, -".json".length);
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    bundle[scopeId][key] = JSON.parse(raw);
    count += 1;
  }
  return count;
}

const cuvRootCount = ingestDir("cuv-simp", srcRoot);
const cuvV20Dir = path.join(srcRoot, "cuv-v20");
const cuvV20Count = fs.existsSync(cuvV20Dir) ? ingestDir("cuv-v20", cuvV20Dir) : 0;
const webDir = path.join(srcRoot, "web-en");
const teochewDir = path.join(srcRoot, "teochew-nt");
const kjvDir = path.join(srcRoot, "kjv");
// WEBP 时间轴必须由 App 实际播放的 TheAudioPower MP3 重新生成。
const webCount = fs.existsSync(webDir) ? ingestDir("web-en", webDir) : 0;
const kjvCount = fs.existsSync(kjvDir) ? ingestDir("kjv", kjvDir) : 0;
const teochewCount = fs.existsSync(teochewDir) ? ingestDir("teochew-nt", teochewDir) : 0;

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(bundle));

const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
console.log(
  `Wrote verse-timings-bundle.json (${mb} MB): cuv-v20=${cuvV20Count}, cuv-legacy=${cuvRootCount}, web-en=${webCount}, kjv=${kjvCount}, teochew-nt=${teochewCount}`,
);
