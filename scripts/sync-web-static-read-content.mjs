/**
 * 把网页读经用的导读 / 段落 JSON 同步到 public/read/，供静态托管直连。
 *
 *   node scripts/sync-web-static-read-content.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "read");

const copies = [
  ["data/bible/open-usfm-chapter-segments.zh.json", "open-usfm-chapter-segments.zh.json"],
  [
    "data/bible/open-usfm-chapter-segments.story.t1.zh.json",
    "open-usfm-chapter-segments.story.t1.zh.json",
  ],
  ["data/bible/info-edition-v1-published.json", "info-edition-v1-published.json"],
  ["data/admin/generation-roles.json", "generation-roles.json"],
];

fs.mkdirSync(outDir, { recursive: true });

for (const [srcRel, destName] of copies) {
  const src = path.join(root, srcRel);
  const dest = path.join(outDir, destName);
  if (!fs.existsSync(src)) {
    console.warn(`[skip] missing ${srcRel}`);
    continue;
  }
  fs.copyFileSync(src, dest);
  const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
  console.log(`[ok] ${destName} (${mb} MB)`);
}

console.log(`[done] → ${path.relative(root, outDir)}`);
