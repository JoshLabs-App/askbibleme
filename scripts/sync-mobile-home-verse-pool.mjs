#!/usr/bin/env node
/**
 * 复制网站首页经文池到 Expo assets：explore-curated-700 + theme-repeat-ge5 manifest。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopeIds = ["explore-curated-700", "theme-repeat-ge5"];

function copyScope(scopeId) {
  const srcDir = path.join(repoRoot, "public", "data", "home-prayer-pools", scopeId);
  const destDir = path.join(
    repoRoot,
    "apps",
    "askbible-mobile",
    "assets",
    "content",
    "home-prayer-pools",
    scopeId,
  );
  if (!fs.existsSync(srcDir)) {
    console.warn(`Skip ${scopeId}: missing ${srcDir}`);
    return false;
  }
  fs.mkdirSync(destDir, { recursive: true });
  const names = fs.readdirSync(srcDir).filter((n) => n === "manifest.json" || /^chunk-\d+\.json$/.test(n));
  for (const name of names) {
    fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
  }
  const mb = (names.reduce((s, n) => s + fs.statSync(path.join(destDir, n)).size, 0) / (1024 * 1024)).toFixed(2);
  console.log(`Copied ${scopeId} (${names.length} files, ${mb} MB) → apps/askbible-mobile/assets/content/home-prayer-pools/${scopeId}/`);
  return true;
}

let copied = 0;
for (const scopeId of scopeIds) {
  if (copyScope(scopeId)) copied += 1;
}
if (copied === 0) {
  console.error("No pools copied. Run: npm run build:curated-700-pool && npm run build:theme-repeat-ge5-menu-pool");
  process.exit(1);
}
