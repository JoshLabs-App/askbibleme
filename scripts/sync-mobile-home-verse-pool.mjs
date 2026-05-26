#!/usr/bin/env node
/**
 * 复制网站首页经文池 theme-repeat-ge5（约 4k+ 句，按主题库重复热度）到 Expo assets。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(repoRoot, "public", "data", "home-prayer-pools", "theme-repeat-ge5");
const destDir = path.join(
  repoRoot,
  "apps",
  "askbible-mobile",
  "assets",
  "content",
  "home-prayer-pools",
  "theme-repeat-ge5",
);

if (!fs.existsSync(srcDir)) {
  console.error(`Missing ${srcDir}. Run: npm run build:theme-repeat-pool`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
const names = fs.readdirSync(srcDir).filter((n) => n.endsWith(".json"));
for (const name of names) {
  fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
}
const mb = (names.reduce((s, n) => s + fs.statSync(path.join(destDir, n)).size, 0) / (1024 * 1024)).toFixed(2);
console.log(
  `Copied theme-repeat-ge5 (${names.length} files, ${mb} MB) → apps/askbible-mobile/assets/content/home-prayer-pools/theme-repeat-ge5/`,
);
