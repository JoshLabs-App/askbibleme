#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scripturePath = path.join(root, "data", "bible", "uploads", "kjv.json");
const timingsDir = path.join(root, "public", "verse-timings", "kjv");
const scripture = JSON.parse(fs.readFileSync(scripturePath, "utf8"));

let expectedChapters = 0;
let timingFiles = 0;
let timingRows = 0;
const errors = [];

for (const [bookId, chapters] of Object.entries(scripture.books ?? {})) {
  for (const [chapter, verseMap] of Object.entries(chapters ?? {})) {
    expectedChapters += 1;
    const file = path.join(timingsDir, `${bookId}-${chapter}.json`);
    if (!fs.existsSync(file)) {
      errors.push(`missing ${bookId}-${chapter}.json`);
      continue;
    }
    timingFiles += 1;
    const rows = JSON.parse(fs.readFileSync(file, "utf8"));
    const expectedVerses = Object.keys(verseMap)
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
    if (!Array.isArray(rows) || rows.length !== expectedVerses.length) {
      errors.push(`${bookId}-${chapter}: rows=${rows?.length ?? "invalid"}, expected=${expectedVerses.length}`);
      continue;
    }
    timingRows += rows.length;
    let previousStart = -1;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.verse !== expectedVerses[i]) {
        errors.push(`${bookId}-${chapter}: expected verse ${expectedVerses[i]}, got ${row.verse}`);
        break;
      }
      if (
        !Number.isFinite(row.start) ||
        !Number.isFinite(row.end) ||
        row.start < 0 ||
        row.end < row.start ||
        row.start < previousStart
      ) {
        errors.push(`${bookId}-${chapter}:${row.verse}: invalid ${row.start}..${row.end}`);
        break;
      }
      previousStart = row.start;
    }
  }
}

const summary = { expectedChapters, timingFiles, timingRows, errors: errors.length };
console.log(JSON.stringify(summary, null, 2));
if (errors.length) {
  console.error(errors.slice(0, 100).join("\n"));
  process.exit(1);
}
