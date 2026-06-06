#!/usr/bin/env node
/**
 * 基于和合本章目录生成 BLM 西语整章音频清单（ebible spablm/mp3）。
 *
 * 输出：data/bible/blm-es-chapter-audio-manifest.json
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const cuvManifestPath = path.join(cwd, "data", "bible", "cuv-chapter-audio-manifest.json");
const outPath = path.join(cwd, "data", "bible", "blm-es-chapter-audio-manifest.json");
const BLM_AUDIO_BASE = "https://ebible.org/spablm/mp3";

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

const BLM_CODE_ALIAS = {
  ECC: "ECL",
  NAM: "NAH",
  ZEC: "ZAC",
  PHM: "FLM",
};

function blmBookOrdinal(bookId) {
  const n = BOOK_NUMBER[bookId];
  if (!n) return null;
  // spablm 目录包含次经，NT 从 70 开始。
  return n <= 39 ? n : n + 30;
}

function parseCuvChapterFiles(rawFiles) {
  const out = [];
  for (const name of rawFiles) {
    const m = /^([A-Z0-9]{2,8})-(\d+)\.mp3$/i.exec(String(name || ""));
    if (!m) continue;
    out.push({ bookId: m[1].toUpperCase(), chapter: Number(m[2]) });
  }
  return out;
}

function buildBlmEntry(bookId, chapter) {
  const ordinal = blmBookOrdinal(bookId);
  if (!ordinal || !Number.isInteger(chapter) || chapter < 1) return null;
  if (bookId === "PSA") return null;
  const ord = String(ordinal).padStart(2, "0");
  const ch = String(chapter).padStart(2, "0");
  const remoteBookCode = BLM_CODE_ALIAS[bookId] ?? bookId;
  const remoteFilename = `spablm_${ord}_${remoteBookCode}_${ch}.mp3`;
  return {
    bookId,
    chapter,
    localFilename: `${bookId}-${chapter}.mp3`,
    remoteFilename,
    remoteUrl: `${BLM_AUDIO_BASE}/${remoteFilename}`,
  };
}

function main() {
  if (!fs.existsSync(cuvManifestPath)) {
    console.error(`Missing ${cuvManifestPath}`);
    process.exit(1);
  }
  const cuvManifest = JSON.parse(fs.readFileSync(cuvManifestPath, "utf8"));
  const files = Array.isArray(cuvManifest.files) ? cuvManifest.files : [];
  const refs = parseCuvChapterFiles(files);
  const entries = [];
  for (const ref of refs) {
    const item = buildBlmEntry(ref.bookId, ref.chapter);
    if (item) entries.push(item);
  }
  entries.sort((a, b) => {
    const an = BOOK_NUMBER[a.bookId] ?? 999;
    const bn = BOOK_NUMBER[b.bookId] ?? 999;
    if (an !== bn) return an - bn;
    return a.chapter - b.chapter;
  });

  const manifest = {
    version: 1,
    source: "eBible spablm mp3 directory",
    note: "Psalm chapters are currently unavailable in spablm mp3 directory.",
    count: entries.length,
    entries,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${entries.length} entries → ${outPath}`);
}

main();
