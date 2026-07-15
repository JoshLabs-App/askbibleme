#!/usr/bin/env node
/**
 * 从和合本 manifest 书章列表生成官方 WEBP 整章录音清单。
 * 网页与 App 直接引用 eBible.org 的完整 WEBP OGG，不在本站保存音频副本。
 *
 *   npm run audio:web-en-manifest
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const cuvManifestPath = path.join(cwd, "data", "bible", "cuv-chapter-audio-manifest.json");
const outPath = path.join(cwd, "data", "bible", "web-en-chapter-audio-manifest.json");

const WEBP_OGG_BASE = "https://ebible.org/engwebp/ogg";

const BOOK_NAME_EN = {
  GEN: "Genesis",
  EXO: "Exodus",
  LEV: "Leviticus",
  NUM: "Numbers",
  DEU: "Deuteronomy",
  JOS: "Joshua",
  JDG: "Judges",
  RUT: "Ruth",
  "1SA": "1 Samuel",
  "2SA": "2 Samuel",
  "1KI": "1 Kings",
  "2KI": "2 Kings",
  "1CH": "1 Chronicles",
  "2CH": "2 Chronicles",
  EZR: "Ezra",
  NEH: "Nehemiah",
  EST: "Esther",
  JOB: "Job",
  PSA: "Psalm",
  PRO: "Proverbs",
  ECC: "Ecclesiastes",
  SNG: "Song of Songs",
  ISA: "Isaiah",
  JER: "Jeremiah",
  LAM: "Lamentations",
  EZK: "Ezekiel",
  DAN: "Daniel",
  HOS: "Hosea",
  JOL: "Joel",
  AMO: "Amos",
  OBA: "Obadiah",
  JON: "Jonah",
  MIC: "Micah",
  NAM: "Nahum",
  HAB: "Habakkuk",
  ZEP: "Zephaniah",
  HAG: "Haggai",
  ZEC: "Zechariah",
  MAL: "Malachi",
  MAT: "Matthew",
  MRK: "Mark",
  LUK: "Luke",
  JHN: "John",
  ACT: "Acts",
  ROM: "Romans",
  "1CO": "1 Corinthians",
  "2CO": "2 Corinthians",
  GAL: "Galatians",
  EPH: "Ephesians",
  PHP: "Philippians",
  COL: "Colossians",
  "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians",
  "1TI": "1 Timothy",
  "2TI": "2 Timothy",
  TIT: "Titus",
  PHM: "Philemon",
  HEB: "Hebrews",
  JAS: "James",
  "1PE": "1 Peter",
  "2PE": "2 Peter",
  "1JN": "1 John",
  "2JN": "2 John",
  "3JN": "3 John",
  JUD: "Jude",
  REV: "Revelation",
};

const BOOK_NUMBER = {
  GEN: 1,
  EXO: 2,
  LEV: 3,
  NUM: 4,
  DEU: 5,
  JOS: 6,
  JDG: 7,
  RUT: 8,
  "1SA": 9,
  "2SA": 10,
  "1KI": 11,
  "2KI": 12,
  "1CH": 13,
  "2CH": 14,
  EZR: 15,
  NEH: 16,
  EST: 17,
  JOB: 18,
  PSA: 19,
  PRO: 20,
  ECC: 21,
  SNG: 22,
  ISA: 23,
  JER: 24,
  LAM: 25,
  EZK: 26,
  DAN: 27,
  HOS: 28,
  JOL: 29,
  AMO: 30,
  OBA: 31,
  JON: 32,
  MIC: 33,
  NAM: 34,
  HAB: 35,
  ZEP: 36,
  HAG: 37,
  ZEC: 38,
  MAL: 39,
  MAT: 40,
  MRK: 41,
  LUK: 42,
  JHN: 43,
  ACT: 44,
  ROM: 45,
  "1CO": 46,
  "2CO": 47,
  GAL: 48,
  EPH: 49,
  PHP: 50,
  COL: 51,
  "1TH": 52,
  "2TH": 53,
  "1TI": 54,
  "2TI": 55,
  TIT: 56,
  PHM: 57,
  HEB: 58,
  JAS: 59,
  "1PE": 60,
  "2PE": 61,
  "1JN": 62,
  "2JN": 63,
  "3JN": 64,
  JUD: 65,
  REV: 66,
};

function remoteUrl(bookId, chapter) {
  const n = BOOK_NUMBER[bookId];
  if (!n) throw new Error(`Unknown WEBP book id: ${bookId}`);
  const name = bookId === "PSA"
    ? "Psalms"
    : bookId === "SNG"
      ? "SongOfSolomon"
      : bookId === "1CH"
        ? "1Chron"
        : bookId === "2CH"
          ? "2Chron"
          : (BOOK_NAME_EN[bookId] ?? bookId).replace(/\s+/g, "");
  const dir = `${String(n).padStart(2, "0")}_${name}`;
  const unpaddedChapterBooks = new Set([
    "AMO", "OBA", "JOL", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "MAL",
    "LAM", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT",
    "PHM", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
  ]);
  const chapterToken = unpaddedChapterBooks.has(bookId)
    ? String(chapter)
    : String(chapter).padStart(2, "0");
  const filenamePrefix = bookId === "GAL"
    ? "40_Galatians"
    : bookId === "COL"
      ? "52_Colossians"
      : dir;
  const separator = bookId === "JON" ? "_" : "_C";
  return `${WEBP_OGG_BASE}/${dir}/${filenamePrefix}${separator}${chapterToken}.ogg`;
}

function main() {
  if (!fs.existsSync(cuvManifestPath)) {
    console.error(`Missing ${cuvManifestPath}`);
    process.exit(1);
  }
  const cuv = JSON.parse(fs.readFileSync(cuvManifestPath, "utf8"));
  const files = Array.isArray(cuv.files) ? cuv.files : [];
  const entries = [];
  for (const filename of files) {
    const m = /^([A-Z0-9]{2,8})-(\d+)\.mp3$/i.exec(filename);
    if (!m) continue;
    const bookId = m[1].toUpperCase();
    const chapter = Number(m[2]);
    entries.push({
      bookId,
      chapter,
      localFilename: filename.replace(/\.mp3$/i, ".ogg"),
      remoteUrl: remoteUrl(bookId, chapter),
    });
  }
  entries.sort((a, b) =>
    a.bookId === b.bookId ? a.chapter - b.chapter : a.bookId.localeCompare(b.bookId),
  );
  const manifest = {
    version: 1,
    source: "eBible.org WEBP complete recording by James Toebes (official OGG, referenced directly)",
    count: entries.length,
    entries,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${entries.length} entries → ${outPath}`);
}

main();
