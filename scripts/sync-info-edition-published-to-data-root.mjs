#!/usr/bin/env node
/**
 * 将仓库内 data/bible/info-edition-v1-published.json 同步到 Render 持久盘根目录。
 * 在 Render Shell 或本机（挂载了同路径时）执行：
 *   DATA_ROOT=/var/data node scripts/sync-info-edition-published-to-data-root.mjs
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const src = path.join(cwd, "data", "bible", "info-edition-v1-published.json");
const root =
  process.env.DATA_ROOT?.trim() ||
  process.env.INFO_EDITION_DATA_DIR?.trim();

if (!root) {
  console.error("Set DATA_ROOT or INFO_EDITION_DATA_DIR (e.g. DATA_ROOT=/var/data)");
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error(`Source not found: ${src}`);
  process.exit(1);
}

const dest = path.join(root, "info-edition-v1-published.json");
const srcStat = fs.statSync(src);

let skip = false;
try {
  const destStat = fs.statSync(dest);
  if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
    skip = true;
  }
} catch {
  /* copy */
}

if (skip) {
  console.log(`Unchanged: ${dest}`);
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log(`Synced ${src} → ${dest} (${srcStat.size} bytes).`);
