#!/usr/bin/env node
/**
 * Import the official 66-book World English Bible Protestant edition (WEBP)
 * into the existing `web-en` translation id used by the web and mobile apps.
 *
 * Source: https://ebible.org/Scriptures/engwebp_usfx.zip
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://ebible.org/Scriptures/engwebp_usfx.zip";
const SOURCE_XML = "engwebp_usfx.xml";
const TRANSLATION_ID = "web-en";
const SELAH_FORMAT = "selah-bible-v1";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadPath = path.join(repoRoot, "data", "bible", "uploads", `${TRANSLATION_ID}.json`);
const indexPath = path.join(repoRoot, "data", "bible", "translations.json");

const BOOK_IDS = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI",
  "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG",
  "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC",
  "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT",
  "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI",
  "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

/**
 * WEBP follows the critical-text placement of the closing doxology at
 * Romans 14:24-26. Chinese Union Version and other TR-based editions place
 * the same text at Romans 16:25-27. Keep aliases at the latter references so
 * cross-translation verse keys (including the home golden-verse pool) resolve
 * to the same passage instead of appearing to be missing.
 */
function addCrossVersificationAliases(books) {
  const romans = books.ROM;
  const source = romans?.["14"];
  if (!romans || !source?.["24"] || !source?.["25"] || !source?.["26"]) {
    throw new Error("WEBP source is missing Romans 14:24-26 versification source");
  }
  romans["16"] ??= {};
  romans["16"]["25"] = source["24"];
  romans["16"]["26"] = source["25"];
  romans["16"]["27"] = source["26"];
  return 3;
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXml(value) {
  return decodeXmlEntities(
    String(value || "")
      .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, " ")
      .replace(/<x\b[^>]*>[\s\S]*?<\/x>/g, " ")
      .replace(/<fig\b[^>]*>[\s\S]*?<\/fig>/g, " ")
      .replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, " ")
      .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim(),
  );
}

function extractBookVerses(xml, bookId) {
  const bookMatch = xml.match(
    new RegExp(
      `<book\\b[^>]*id="${bookId}"[^>]*>([\\s\\S]*?)(?=<book\\b[^>]*id="[^"]+"[^>]*>|<\\/usfx>|$)`,
      "i",
    ),
  );
  if (!bookMatch) return [];

  const rows = [];
  const chapterRe = /<c\b[^>]*id="(\d+)"[^>]*\/>[\s\S]*?(?=<c\b[^>]*id="\d+"[^>]*\/>|$)/gi;
  const verseRe = /<v\b[^>]*id="(\d+)"[^>]*\/>([\s\S]*?)<ve\s*\/>/gi;
  let chapterMatch;
  while ((chapterMatch = chapterRe.exec(bookMatch[1])) !== null) {
    const chapter = Number(chapterMatch[1]);
    verseRe.lastIndex = 0;
    let verseMatch;
    while ((verseMatch = verseRe.exec(chapterMatch[0])) !== null) {
      const verse = Number(verseMatch[1]);
      const text = stripXml(verseMatch[2]);
      if (text) rows.push({ chapter, verse, text });
    }
  }
  return rows;
}

function buildPayload(xml) {
  const books = {};
  let verseCount = 0;
  for (const bookId of BOOK_IDS) {
    const rows = extractBookVerses(xml, bookId);
    if (!rows.length) throw new Error(`WEBP source is missing canonical book ${bookId}`);
    const chapters = {};
    for (const row of rows) {
      const chapter = String(row.chapter);
      if (!chapters[chapter]) chapters[chapter] = {};
      chapters[chapter][String(row.verse)] = row.text;
      verseCount += 1;
    }
    books[bookId] = chapters;
  }
  verseCount += addCrossVersificationAliases(books);
  return { payload: { format: SELAH_FORMAT, books }, verseCount };
}

async function downloadSource(zipPath) {
  const override = String(process.env.WEBP_USFX_ZIP || "").trim();
  if (override) {
    fs.copyFileSync(path.resolve(override), zipPath);
    return;
  }
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`WEBP download failed (${response.status})`);
  fs.writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "askbible-webp-import-"));
  try {
    const zipPath = path.join(tmpDir, "engwebp_usfx.zip");
    await downloadSource(zipPath);
    const xml = execFileSync("unzip", ["-p", zipPath, SOURCE_XML], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const { payload, verseCount } = buildPayload(xml);
    if (Object.keys(payload.books).length !== 66 || verseCount < 31_000) {
      throw new Error(`Unexpected WEBP canon: books=${Object.keys(payload.books).length}, verses=${verseCount}`);
    }

    const body = `${JSON.stringify(payload)}\n`;
    fs.writeFileSync(uploadPath, body, "utf8");

    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const item = index.translations?.find((entry) => entry.id === TRANSLATION_ID);
    if (!item) throw new Error(`Missing ${TRANSLATION_ID} in translations.json`);
    Object.assign(item, {
      labelZh: "WEBP 英译本",
      labelEn: "World English Bible (WEBP)",
      language: "en",
      sourceFile: `uploads/${TRANSLATION_ID}.json`,
      updatedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(body),
      verseCount,
    });
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    console.log(`Imported WEBP as ${TRANSLATION_ID}: 66 books, ${verseCount} verses, ${Buffer.byteLength(body)} bytes`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

await main();
