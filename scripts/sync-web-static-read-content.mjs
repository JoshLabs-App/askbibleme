/**
 * 把网页读经用的导读 / 段落 JSON 同步到 public/read/，供静态托管直连。
 * 增量缓存：内容一致时不重写目标文件，避免无谓刷新 mtime 触发下游重编；支持 FORCE_PREBUILD=1。
 *
 *   node scripts/sync-web-static-read-content.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const outDir = path.join(root, "public", "read");
const cachePath = path.join(root, "node_modules", ".cache", "askbible-prebuild", "sync-web-static-read-content.json");
const forcePrebuild = process.env.FORCE_PREBUILD === "1";

const copies = [
  ["data/bible/open-usfm-chapter-segments.zh.json", "open-usfm-chapter-segments.zh.json"],
  [
    "data/bible/open-usfm-chapter-segments.story.t1.zh.json",
    "open-usfm-chapter-segments.story.t1.zh.json",
  ],
  ["data/bible/info-edition-v1-published.json", "info-edition-v1-published.json"],
  ["data/admin/generation-roles.json", "generation-roles.json"],
];

function sha256File(absPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function readCache() {
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(data) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(data)}\n`, "utf8");
}

fs.mkdirSync(outDir, { recursive: true });

const scriptSha256 = sha256File(scriptPath);
const prevCache = readCache();
const prevFiles = prevCache?.scriptSha256 === scriptSha256 && prevCache?.files ? prevCache.files : {};
const nextFiles = {};
let cacheDirty = !prevCache || prevCache.scriptSha256 !== scriptSha256;
let skipped = 0;
let copied = 0;

for (const [srcRel, destName] of copies) {
  const src = path.join(root, srcRel);
  const dest = path.join(outDir, destName);
  if (!fs.existsSync(src)) {
    console.warn(`[skip] missing ${srcRel}`);
    if (prevFiles[destName]) cacheDirty = true;
    continue;
  }

  const srcStat = fs.statSync(src);
  const destExists = fs.existsSync(dest);
  const destStat = destExists ? fs.statSync(dest) : null;
  const prev = prevFiles[destName];

  if (
    !forcePrebuild &&
    prev &&
    destStat &&
    prev.srcSize === srcStat.size &&
    prev.srcMtimeMs === srcStat.mtimeMs &&
    prev.destSize === destStat.size &&
    prev.destMtimeMs === destStat.mtimeMs
  ) {
    nextFiles[destName] = prev;
    skipped++;
    continue;
  }

  const srcSha256 = sha256File(src);
  const sameContent =
    destStat !== null &&
    destStat.size === srcStat.size &&
    sha256File(dest) === srcSha256;

  if (sameContent) {
    nextFiles[destName] = {
      srcSize: srcStat.size,
      srcMtimeMs: srcStat.mtimeMs,
      srcSha256,
      destSize: destStat.size,
      destMtimeMs: destStat.mtimeMs,
    };
    cacheDirty = true;
    skipped++;
    continue;
  }

  fs.copyFileSync(src, dest);
  const newDestStat = fs.statSync(dest);
  nextFiles[destName] = {
    srcSize: srcStat.size,
    srcMtimeMs: srcStat.mtimeMs,
    srcSha256,
    destSize: newDestStat.size,
    destMtimeMs: newDestStat.mtimeMs,
  };
  cacheDirty = true;
  copied++;
  const mb = (newDestStat.size / (1024 * 1024)).toFixed(1);
  console.log(`[ok] ${destName} (${mb} MB)`);
}

if (cacheDirty) {
  writeCache({ version: 1, scriptSha256, files: nextFiles });
}

if (copied === 0 && skipped > 0) {
  console.log(`[skip] public/read up to date (${skipped} files)`);
} else {
  console.log(`[done] → ${path.relative(root, outDir)}`);
}
