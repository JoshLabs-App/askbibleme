import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(absPath, data) {
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, `${JSON.stringify(data)}\n`, "utf8");
}

function copyIfExists(src, dst) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
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
const bootstrapMap = {};
if (fs.existsSync(manifestPath)) {
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
      const cp = path.join(poolDir, `chunk-${ci}.json`);
      chunkCache.set(ci, fs.existsSync(cp) ? JSON.parse(fs.readFileSync(cp, "utf8")) : null);
    }
    const verse = chunkCache.get(ci)?.verses?.find((v) => v.verseKey === key);
    if (verse) verses.push(verse);
  }
  bootstrapMap["theme-repeat-ge5"] = verses;
}
writeJson(path.join(cwd, "lib", "generated", "home-verse-bootstrap.json"), bootstrapMap);

// 5. chapter-segments per-book split -> public/data/chapter-segments/{bookId}.json
const zhSegPath = path.join(cwd, "data", "bible", "open-usfm-chapter-segments.zh.json");
const plainSegPath = path.join(cwd, "data", "bible", "open-usfm-chapter-segments.json");
const storyT1Path = path.join(cwd, "data", "bible", "open-usfm-chapter-segments.story.t1.zh.json");
const baseSeg = fs.existsSync(zhSegPath)
  ? JSON.parse(fs.readFileSync(zhSegPath, "utf8"))
  : fs.existsSync(plainSegPath)
    ? JSON.parse(fs.readFileSync(plainSegPath, "utf8"))
    : { books: {} };
const storyT1 = fs.existsSync(storyT1Path)
  ? JSON.parse(fs.readFileSync(storyT1Path, "utf8"))
  : { books: {} };
const segBooks = baseSeg?.books ?? {};
const storyBooks = storyT1?.books ?? {};
const allBookIds = new Set([...Object.keys(segBooks), ...Object.keys(storyBooks)]);
const segOutDir = path.join(cwd, "public", "data", "chapter-segments");
ensureDir(segOutDir);
for (const bookId of allBookIds) {
  writeJson(path.join(segOutDir, `${bookId}.json`), {
    chapters: segBooks[bookId] ?? {},
    storyT1: storyBooks[bookId] ?? {},
  });
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

// 8. resource-pack asset checksums index (precomputed for public/ assets present at build time)
function md5File(absPath) {
  const hash = crypto.createHash("md5");
  hash.update(fs.readFileSync(absPath));
  return hash.digest("hex");
}

function scanAssetsUnder(relPrefixes) {
  const out = {};
  for (const prefix of relPrefixes) {
    const dir = path.join(cwd, "public", prefix.slice(1));
    if (!fs.existsSync(dir)) continue;
    const walk = (cur) => {
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const abs = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          walk(abs);
        } else if (entry.isFile()) {
          const rel = "/" + path.relative(path.join(cwd, "public"), abs).replaceAll("\\", "/");
          const stat = fs.statSync(abs);
          out[rel] = { path: rel, size: stat.size, md5: md5File(abs) };
        }
      }
    };
    walk(dir);
  }
  return out;
}

writeJson(path.join(cwd, "public", "data", "resource-packs", "asset-stats.json"), {
  assets: scanAssetsUnder(["/music", "/nature", "/audio"]),
});

console.log(
  `[build-cf-static-assets] ok: ${allBookIds.size} chapter-segment books, ${bgFiles.length} bg-uploads, bootstrap=${bootstrapMap["theme-repeat-ge5"]?.length ?? 0}`,
);
