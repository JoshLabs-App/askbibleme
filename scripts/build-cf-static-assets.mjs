import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const cwd = process.cwd();
const cacheDir = path.join(cwd, "node_modules", ".cache", "askbible-prebuild");
const assetMd5CachePath = path.join(cacheDir, "asset-md5-cache.json");
const buildCachePath = path.join(cacheDir, "cf-static-assets-cache.json");
const forcePrebuild = process.env.FORCE_PREBUILD === "1";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256File(absPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function readJsonOrNull(absPath) {
  if (!fs.existsSync(absPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

/** 写入前比对磁盘现有文件内容，若字节完全一致则不重写，保护 Vite / Next 文件监听缓存。 */
function writeJson(absPath, data) {
  const next = `${JSON.stringify(data)}\n`;
  if (fs.existsSync(absPath)) {
    try {
      if (fs.readFileSync(absPath, "utf8") === next) return false;
    } catch {
      /* fall through and rewrite */
    }
  }
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, next, "utf8");
  return true;
}

const scriptSha256 = sha256File(scriptPath);
const prevBuildCache = readJsonOrNull(buildCachePath);
const sameScript = prevBuildCache?.version === 1 && prevBuildCache?.scriptSha256 === scriptSha256;
const prevCopies = sameScript && prevBuildCache?.copies ? prevBuildCache.copies : {};
const prevSha256ByPath = sameScript && prevBuildCache?.sha256ByPath ? prevBuildCache.sha256ByPath : {};
const nextBuildCache = {
  version: 1,
  scriptSha256,
  bootstrap: null,
  chapterSegments: null,
  copies: {},
  sha256ByPath: {},
};

function cachedSha256(absPath) {
  const rel = path.relative(cwd, absPath).replaceAll("\\", "/");
  const st = fs.statSync(absPath);
  const prev = prevSha256ByPath[rel];
  if (!forcePrebuild && prev && prev.size === st.size && prev.mtimeMs === st.mtimeMs && typeof prev.sha256 === "string") {
    nextBuildCache.sha256ByPath[rel] = prev;
    return { sha256: prev.sha256, size: st.size };
  }
  const sha256 = sha256File(absPath);
  nextBuildCache.sha256ByPath[rel] = { size: st.size, mtimeMs: st.mtimeMs, sha256 };
  return { sha256, size: st.size };
}

function copyIfExists(src, dst) {
  if (!fs.existsSync(src)) return false;
  const srcStat = fs.statSync(src);
  const dstExists = fs.existsSync(dst);
  const dstStat = dstExists ? fs.statSync(dst) : null;
  const key = path.relative(cwd, dst).replaceAll("\\", "/");
  const prev = prevCopies[key];

  if (
    !forcePrebuild &&
    dstStat &&
    prev &&
    prev.srcSize === srcStat.size &&
    prev.srcMtimeMs === srcStat.mtimeMs &&
    prev.dstSize === dstStat.size &&
    prev.dstMtimeMs === dstStat.mtimeMs
  ) {
    nextBuildCache.copies[key] = prev;
    return true;
  }

  const srcBuf = fs.readFileSync(src);
  if (dstStat && dstStat.size === srcStat.size) {
    const dstBuf = fs.readFileSync(dst);
    if (Buffer.compare(srcBuf, dstBuf) === 0) {
      nextBuildCache.copies[key] = {
        srcSize: srcStat.size,
        srcMtimeMs: srcStat.mtimeMs,
        dstSize: dstStat.size,
        dstMtimeMs: dstStat.mtimeMs,
      };
      return true;
    }
  }

  ensureDir(path.dirname(dst));
  fs.writeFileSync(dst, srcBuf);
  const newDstStat = fs.statSync(dst);
  nextBuildCache.copies[key] = {
    srcSize: srcStat.size,
    srcMtimeMs: srcStat.mtimeMs,
    dstSize: newDstStat.size,
    dstMtimeMs: newDstStat.mtimeMs,
  };
  return true;
}

function outputDirHasFiles(dir, expectedFiles) {
  if (!Array.isArray(expectedFiles) || expectedFiles.length === 0 || !fs.existsSync(dir)) return false;
  let actual;
  try {
    actual = fs.readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return false;
  }
  if (actual.length !== expectedFiles.length) return false;
  const actualSet = new Set(actual);
  for (const name of expectedFiles) {
    if (!actualSet.has(name)) return false;
  }
  return true;
}

// 1. app-build-meta.json
const appBuildSrc = path.join(cwd, "public", "app-build.json");
const appBuildMeta = fs.existsSync(appBuildSrc)
  ? JSON.parse(fs.readFileSync(appBuildSrc, "utf8"))
  : { id: "unknown" };
writeJson(path.join(cwd, "lib", "generated", "app-build-meta.json"), appBuildMeta);

// 2. branding-assets.json
const brandingHasIcons =
  fs.existsSync(path.join(cwd, "public", "branding", "icon-192.png")) &&
  fs.existsSync(path.join(cwd, "public", "branding", "icon-512.png"));
writeJson(path.join(cwd, "lib", "generated", "branding-assets.json"), {
  iconsExist: brandingHasIcons,
});

// 3. golden-verse-bg-uploads.json
const bgDir = path.join(cwd, "public", "golden-verses", "bg-uploads");
const bgFiles = fs.existsSync(bgDir)
  ? fs
      .readdirSync(bgDir)
      .filter((n) => /\.(png|jpe?g|webp|avif)$/i.test(n) && !n.startsWith("."))
      .sort()
  : [];
writeJson(path.join(cwd, "lib", "generated", "golden-verse-bg-uploads.json"), {
  files: bgFiles,
});

// 4. home-verse-bootstrap.json (first 40 bootstrap verses from theme-repeat-ge5)
const poolDir = path.join(cwd, "public", "data", "home-prayer-pools", "theme-repeat-ge5");
const manifestPath = path.join(poolDir, "manifest.json");
const bootstrapOutPath = path.join(cwd, "lib", "generated", "home-verse-bootstrap.json");
let bootstrapCount = 0;
const prevBootstrap = sameScript ? prevBuildCache?.bootstrap : null;
let bootstrapSkipped = false;
if (
  !forcePrebuild &&
  prevBootstrap &&
  fs.existsSync(bootstrapOutPath) &&
  fs.existsSync(manifestPath)
) {
  const { sha256: manifestSha } = cachedSha256(manifestPath);
  if (manifestSha === prevBootstrap.manifestSha256 && prevBootstrap.chunkShas) {
    let chunksOk = true;
    for (const [chunkName, expectedSha] of Object.entries(prevBootstrap.chunkShas)) {
      const cp = path.join(poolDir, chunkName);
      if (!fs.existsSync(cp) || cachedSha256(cp).sha256 !== expectedSha) {
        chunksOk = false;
        break;
      }
    }
    if (chunksOk) {
      bootstrapCount = prevBootstrap.count ?? 0;
      nextBuildCache.bootstrap = prevBootstrap;
      bootstrapSkipped = true;
    }
  }
}

if (!bootstrapSkipped) {
  const bootstrapMap = {};
  const chunkShas = {};
  let manifestSha256 = null;
  if (fs.existsSync(manifestPath)) {
    manifestSha256 = cachedSha256(manifestPath).sha256;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const keys =
      Array.isArray(manifest.bootstrapVerseKeys) && manifest.bootstrapVerseKeys.length > 0
        ? manifest.bootstrapVerseKeys.slice(0, 40)
        : (manifest.entries ?? []).slice(0, 40).map((e) => e.verseKey);
    const chunkCache = new Map();
    const verses = [];
    for (const key of keys) {
      const row = (manifest.entries ?? []).find((e) => e.verseKey === key);
      if (!row) continue;
      const ci = row.chunkIndex;
      if (!chunkCache.has(ci)) {
        const chunkName = `chunk-${ci}.json`;
        const cp = path.join(poolDir, chunkName);
        if (fs.existsSync(cp)) {
          chunkShas[chunkName] = cachedSha256(cp).sha256;
          chunkCache.set(ci, JSON.parse(fs.readFileSync(cp, "utf8")));
        } else {
          chunkShas[chunkName] = null;
          chunkCache.set(ci, null);
        }
      }
      const verse = chunkCache.get(ci)?.verses?.find((v) => v.verseKey === key);
      if (verse) verses.push(verse);
    }
    bootstrapMap["theme-repeat-ge5"] = verses;
    bootstrapCount = verses.length;
  }
  writeJson(bootstrapOutPath, bootstrapMap);
  nextBuildCache.bootstrap = { manifestSha256, chunkShas, count: bootstrapCount };
}

// 5. chapter-segments per-book split -> public/data/chapter-segments/{bookId}.json
const zhSegPath = path.join(cwd, "data", "bible", "open-usfm-chapter-segments.zh.json");
const plainSegPath = path.join(cwd, "data", "bible", "open-usfm-chapter-segments.json");
const storyT1Path = path.join(cwd, "data", "bible", "open-usfm-chapter-segments.story.t1.zh.json");
const activeBaseSegPath = fs.existsSync(zhSegPath)
  ? zhSegPath
  : fs.existsSync(plainSegPath)
    ? plainSegPath
    : null;
const segInputKey = [
  activeBaseSegPath ? `${path.relative(cwd, activeBaseSegPath)}:${cachedSha256(activeBaseSegPath).sha256}` : "base:missing",
  fs.existsSync(storyT1Path) ? `story:${cachedSha256(storyT1Path).sha256}` : "story:missing",
].join("|");
const segOutDir = path.join(cwd, "public", "data", "chapter-segments");
const prevSeg = sameScript ? prevBuildCache?.chapterSegments : null;
let segBookCount = 0;

if (
  !forcePrebuild &&
  prevSeg &&
  prevSeg.inputKey === segInputKey &&
  outputDirHasFiles(segOutDir, prevSeg.files)
) {
  segBookCount = prevSeg.files.length;
  nextBuildCache.chapterSegments = prevSeg;
} else {
  const baseSeg = activeBaseSegPath ? JSON.parse(fs.readFileSync(activeBaseSegPath, "utf8")) : { books: {} };
  const storyT1 = fs.existsSync(storyT1Path)
    ? JSON.parse(fs.readFileSync(storyT1Path, "utf8"))
    : { books: {} };
  const segBooks = baseSeg?.books ?? {};
  const storyBooks = storyT1?.books ?? {};
  const allBookIds = new Set([...Object.keys(segBooks), ...Object.keys(storyBooks)]);
  ensureDir(segOutDir);
  const writtenFiles = [];
  for (const bookId of allBookIds) {
    const fileName = `${bookId}.json`;
    writeJson(path.join(segOutDir, fileName), {
      chapters: segBooks[bookId] ?? {},
      storyT1: storyBooks[bookId] ?? {},
    });
    writtenFiles.push(fileName);
  }
  segBookCount = allBookIds.size;
  nextBuildCache.chapterSegments = { inputKey: segInputKey, files: writtenFiles };
}

// 6. bible-reading-plans built/*.json -> public/data/bible-reading-plans/{planId}.json
const plansDir = path.join(cwd, "data", "bible-reading-plans", "built");
const plansOutDir = path.join(cwd, "public", "data", "bible-reading-plans");
if (fs.existsSync(plansDir)) {
  ensureDir(plansOutDir);
  for (const name of fs.readdirSync(plansDir)) {
    if (!name.endsWith(".json")) continue;
    copyIfExists(path.join(plansDir, name), path.join(plansOutDir, name));
  }
}

// 7. static-bundles -> public/data/static-bundles/
const bundles = [
  ["data/legacy-figure-preview.json", "legacy-figure-preview.json"],
  ["data/legacy-figures-timeline.json", "legacy-figures-timeline.json"],
  ["data/legacy-figures-mobile.json", "legacy-figures-mobile.json"],
  ["data/legacy-community-articles.json", "legacy-community-articles.json"],
  ["data/explore-featured-articles/bundle.json", "explore-featured-articles.json"],
];
for (const [srcRel, dstName] of bundles) {
  copyIfExists(path.join(cwd, srcRel), path.join(cwd, "public", "data", "static-bundles", dstName));
}

// 8. resource-pack asset checksums index (precomputed with incremental MD5 cache)
function md5File(absPath) {
  const hash = crypto.createHash("md5");
  hash.update(fs.readFileSync(absPath));
  return hash.digest("hex");
}

function scanAssetsUnder(relPrefixes) {
  const rawMd5Cache = readJsonOrNull(assetMd5CachePath);
  const prevAssets =
    rawMd5Cache?.version === 1 && rawMd5Cache?.assets && typeof rawMd5Cache.assets === "object"
      ? rawMd5Cache.assets
      : {};
  const nextAssetsCache = {};
  const out = {};

  for (const prefix of relPrefixes) {
    const dir = path.join(cwd, "public", prefix.slice(1));
    if (!fs.existsSync(dir)) continue;
    const walk = (cur) => {
      const entries = fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const abs = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          walk(abs);
        } else if (entry.isFile()) {
          const rel = "/" + path.relative(path.join(cwd, "public"), abs).replaceAll("\\", "/");
          const stat = fs.statSync(abs);
          const cached = prevAssets[rel];
          const md5 =
            !forcePrebuild &&
            cached &&
            cached.size === stat.size &&
            cached.mtimeMs === stat.mtimeMs &&
            typeof cached.md5 === "string"
              ? cached.md5
              : md5File(abs);
          nextAssetsCache[rel] = { size: stat.size, mtimeMs: stat.mtimeMs, md5 };
          out[rel] = { path: rel, size: stat.size, md5 };
        }
      }
    };
    walk(dir);
  }

  writeJson(assetMd5CachePath, { version: 1, assets: nextAssetsCache });
  return out;
}

writeJson(path.join(cwd, "public", "data", "resource-packs", "asset-stats.json"), {
  assets: scanAssetsUnder(["/music", "/nature", "/audio"]),
});

// 9. JoshBox-style v2/catalog.json (SHA-256 + sizeBytes for silent atomic PackStore hot-updates, D-44)
const packSources = [
  { id: "bible.cuv-simp", kind: "sqlite", src: "apps/askbible-ios/AskBible/Resources/cuv-simp.sqlite", urlPath: "bible/cuv-simp.sqlite" },
  { id: "bible.cuv-trad", kind: "sqlite", src: "apps/askbible-ios/AskBible/Resources/cuv-trad.sqlite", urlPath: "bible/cuv-trad.sqlite" },
  { id: "bible.web-en", kind: "sqlite", src: "apps/askbible-ios/AskBible/Resources/web-en.sqlite", urlPath: "bible/web-en.sqlite" },
  { id: "bible.ust-en", kind: "sqlite", src: "apps/askbible-ios/AskBible/Resources/ust-en.sqlite", urlPath: "bible/ust-en.sqlite" },
  { id: "companion.xrefs", kind: "sqlite", src: "apps/askbible-ios/AskBible/Resources/scripture-xrefs.sqlite", urlPath: "bible/scripture-xrefs.sqlite" },
  { id: "bundle.explore-articles", kind: "json", src: "public/data/static-bundles/explore-featured-articles.json", urlPath: "data/static-bundles/explore-featured-articles.json" },
  { id: "bundle.figures", kind: "json", src: "public/data/static-bundles/legacy-figures-mobile.json", urlPath: "data/static-bundles/legacy-figures-mobile.json" },
  { id: "ui.web-pack", kind: "web-pack", src: "public/v2/web-pack.json", urlPath: "v2/web-pack.json" },
];

const catalogOutPath = path.join(cwd, "public", "v2", "catalog.json");
const prevCatalog = readJsonOrNull(catalogOutPath);
const prevPacksById = new Map(
  Array.isArray(prevCatalog?.packs) ? prevCatalog.packs.map((entry) => [entry.id, entry]) : [],
);

const catalogPacks = [];
for (const p of packSources) {
  const abs = path.join(cwd, p.src);
  if (!fs.existsSync(abs)) {
    const existing = prevPacksById.get(p.id);
    if (existing) catalogPacks.push(existing);
    continue;
  }
  const { sha256, size } = cachedSha256(abs);
  catalogPacks.push({
    id: p.id,
    kind: p.kind,
    version: sha256.slice(0, 12),
    path: p.urlPath,
    sha256,
    sizeBytes: size,
    sqlite: p.kind === "sqlite",
  });
}

const generatedAt =
  prevCatalog?.generatedAt && JSON.stringify(prevCatalog.packs) === JSON.stringify(catalogPacks)
    ? prevCatalog.generatedAt
    : new Date().toISOString();

writeJson(catalogOutPath, {
  schemaVersion: 2,
  generatedAt,
  packs: catalogPacks,
});

writeJson(buildCachePath, nextBuildCache);

console.log(
  `[build-cf-static-assets] ok: ${segBookCount} chapter-segment books, ${bgFiles.length} bg-uploads, bootstrap=${bootstrapCount}, packs=${catalogPacks.length}`,
);
