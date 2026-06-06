#!/usr/bin/env node
/**
 * 从 FHL 语音 API 生成章节音频 manifest（默认 version=2）。
 *
 *   npm run audio:hakka-manifest
 *   npm run audio:hakka-manifest -- --book MAT
 *   npm run audio:hakka-manifest -- --limit 20
 *   node scripts/build-hakka-audio-manifest.mjs --version 3 --output data/bible/cantonese-v3-audio-manifest.json
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const cuvManifestPath = path.join(cwd, "data", "bible", "cuv-chapter-audio-manifest.json");
const baseJsonUrl = "https://bible.fhl.net/json/au.php";

const BOOK_ORDER = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
  "MAT",
  "MRK",
  "LUK",
  "JHN",
  "ACT",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "PHP",
  "COL",
  "1TH",
  "2TH",
  "1TI",
  "2TI",
  "TIT",
  "PHM",
  "HEB",
  "JAS",
  "1PE",
  "2PE",
  "1JN",
  "2JN",
  "3JN",
  "JUD",
  "REV",
];

function parseArgs(argv) {
  const out = {
    book: null,
    limit: null,
    version: 2,
    output: path.join("data", "bible", "hakka-audio-manifest.json"),
    sourceSite: "https://bible.fhl.net/gbdoc/new/audio_hb.php?version=2",
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--book" && argv[i + 1]) {
      out.book = String(argv[++i]).trim().toUpperCase();
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      out.limit = Math.max(1, Number(argv[++i]));
    } else if (argv[i] === "--version" && argv[i + 1]) {
      out.version = Math.max(1, Number(argv[++i]));
      out.sourceSite = `https://bible.fhl.net/new/audio_hb.php?version=${out.version}`;
    } else if (argv[i] === "--output" && argv[i + 1]) {
      out.output = String(argv[++i]).trim();
    }
  }
  return out;
}

function loadChapterCountsFromCuv() {
  if (!fs.existsSync(cuvManifestPath)) {
    throw new Error(`Missing ${cuvManifestPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(cuvManifestPath, "utf8"));
  const files = Array.isArray(raw.files) ? raw.files : [];
  const map = new Map();
  for (const file of files) {
    const m = /^([A-Z0-9]+)-(\d+)\.mp3$/.exec(file);
    if (!m) continue;
    const bookId = m[1];
    const chap = Number(m[2]);
    const prev = map.get(bookId) || 0;
    if (chap > prev) map.set(bookId, chap);
  }
  return map;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "AskBibleHakkaManifest/1.0" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const { book, limit, version, output, sourceSite } = parseArgs(process.argv.slice(2));
  const outPath = path.isAbsolute(output) ? output : path.join(cwd, output);
  const chapterCountMap = loadChapterCountsFromCuv();

  const selectedBooks = book ? BOOK_ORDER.filter((id) => id === book) : [...BOOK_ORDER];
  if (book && selectedBooks.length === 0) {
    throw new Error(`Unknown book id: ${book}`);
  }

  const entries = [];
  let processed = 0;
  for (let i = 0; i < selectedBooks.length; i++) {
    const bookId = selectedBooks[i];
    const bid = BOOK_ORDER.indexOf(bookId) + 1;
    const totalChapters = chapterCountMap.get(bookId) || 0;
    if (totalChapters <= 0) {
      console.warn(`Skip ${bookId}: chapter count missing`);
      continue;
    }

    for (let chapter = 1; chapter <= totalChapters; chapter++) {
      if (limit && processed >= limit) break;
      const url = `${baseJsonUrl}?version=${version}&bid=${bid}&chap=${chapter}`;
      try {
        const item = await fetchJson(url);
        if (!item || item.status !== "success" || !item.mp3) {
          throw new Error(`invalid payload`);
        }
        entries.push({
          bookId,
          bid,
          chapter,
          chapterLabel: item.chinesef || "",
          remoteUrl: item.mp3,
          remotePath: item.mp3.replace(/^https?:\/\/[^/]+\//, ""),
          localFilename: `${bookId}-${chapter}.mp3`,
        });
        process.stdout.write(`  ${bookId}-${chapter}\n`);
      } catch (err) {
        console.error(`  FAIL ${bookId}-${chapter}: ${err instanceof Error ? err.message : err}`);
      }
      processed += 1;
    }
    if (limit && processed >= limit) break;
  }

  const doc = {
    version: 1,
    source: `fhl-version-${version}`,
    sourceSite,
    apiBase: baseJsonUrl,
    queryVersion: version,
    count: entries.length,
    entries,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`\nWrote ${outPath} (${entries.length} entries).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
