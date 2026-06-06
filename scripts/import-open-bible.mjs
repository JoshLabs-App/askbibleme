#!/usr/bin/env node
/**
 * Import Open Translation Bible (OTB) into Selah bible uploads.
 *
 * Sources:
 * - https://github.com/OpenTranslationBible/open-bible
 * - lang/en-GB
 * - lang/zh-CN
 *
 * Outputs:
 * - data/bible/uploads/otb-en-gb.json
 * - data/bible/uploads/otb-zh-hans.json
 * - data/bible/uploads/otb-zh-hant.json (auto-converted from zh-Hans)
 * - data/bible/translations.json (upsert three ids)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import OpenCC from "opencc-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const BIBLE_DIR = path.join(REPO_ROOT, "data", "bible");
const UPLOADS_DIR = path.join(BIBLE_DIR, "uploads");
const INDEX_PATH = path.join(BIBLE_DIR, "translations.json");
const SELAH_FORMAT = "selah-bible-v1";
const TMP_ROOT = path.join(os.tmpdir(), "askbible-open-bible-import");
const OPEN_BIBLE_CHECKOUT = path.join(TMP_ROOT, "open-bible");
const OPEN_BIBLE_REPO = "https://github.com/OpenTranslationBible/open-bible.git";
const OPEN_BIBLE_BRANCH = "main";

const CANONICAL_BOOK_IDS = [
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

const LANGUAGE_JOBS = [
  { localeDir: "en-GB", outId: "otb-en-gb" },
  { localeDir: "zh-CN", outId: "otb-zh-hans" },
];

const zhHansToHant = OpenCC.Converter({ from: "cn", to: "tw" });

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
}

function prepareOpenBibleCheckout() {
  fs.rmSync(OPEN_BIBLE_CHECKOUT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  run(
    "git",
    [
      "clone",
      "--depth=1",
      "--filter=blob:none",
      "--sparse",
      "--branch",
      OPEN_BIBLE_BRANCH,
      OPEN_BIBLE_REPO,
      OPEN_BIBLE_CHECKOUT,
    ],
    TMP_ROOT,
  );
  run("git", ["sparse-checkout", "set", "lang/en-GB", "lang/zh-CN"], OPEN_BIBLE_CHECKOUT);
}

function parseLeadingNumber(name) {
  const m = String(name).match(/^(\d+)\./);
  if (!m) return null;
  return Number(m[1]);
}

function sortByLeadingNumber(a, b) {
  const na = parseLeadingNumber(a);
  const nb = parseLeadingNumber(b);
  if (na == null && nb == null) return a.localeCompare(b);
  if (na == null) return 1;
  if (nb == null) return -1;
  return na - nb;
}

function ensureDir(pathname) {
  if (!fs.existsSync(pathname) || !fs.statSync(pathname).isDirectory()) {
    throw new Error(`Directory not found: ${pathname}`);
  }
}

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, "utf8"));
}

function normalizeVerseText(lines) {
  const chunks = Array.isArray(lines) ? lines : [];
  const cleaned = chunks
    .map((v) => String(v ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const joined = cleaned.join("\n").trim();
  if (!joined) return "";
  if (joined === "---") return "";
  return joined;
}

function collectLocaleBooks(localeDirName) {
  const localeRoot = path.join(OPEN_BIBLE_CHECKOUT, "lang", localeDirName);
  ensureDir(localeRoot);

  const bookDirs = fs
    .readdirSync(localeRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+\./.test(d.name))
    .map((d) => d.name)
    .sort(sortByLeadingNumber);

  if (bookDirs.length !== CANONICAL_BOOK_IDS.length) {
    throw new Error(
      `${localeDirName} book directory count mismatch: expected ${CANONICAL_BOOK_IDS.length}, got ${bookDirs.length}`,
    );
  }

  /** @type {Record<string, Record<string, Record<string, string>>>} */
  const books = {};
  let verseCount = 0;

  for (let i = 0; i < bookDirs.length; i += 1) {
    const canonicalBookId = CANONICAL_BOOK_IDS[i];
    const bookDirName = bookDirs[i];
    const chapterDir = path.join(localeRoot, bookDirName, "json");
    ensureDir(chapterDir);

    const chapterFiles = fs
      .readdirSync(chapterDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".json"))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

    const chapterMap = {};
    for (const chapterFile of chapterFiles) {
      const payload = readJson(path.join(chapterDir, chapterFile));
      const chapterNo = Number(payload.chapter);
      if (!Number.isInteger(chapterNo) || chapterNo <= 0) continue;
      const verseMap = {};
      const verses = Array.isArray(payload.verses) ? payload.verses : [];
      for (const row of verses) {
        const vn = Number(row?.verse);
        if (!Number.isInteger(vn) || vn <= 0) continue;
        const text = normalizeVerseText(row?.text);
        if (!text) continue;
        verseMap[String(vn)] = text;
      }
      if (Object.keys(verseMap).length > 0) {
        chapterMap[String(chapterNo)] = verseMap;
        verseCount += Object.keys(verseMap).length;
      }
    }

    if (Object.keys(chapterMap).length > 0) {
      books[canonicalBookId] = chapterMap;
    }
  }

  return { books, verseCount };
}

function convertZhHansBooksToHant(books) {
  const out = {};
  for (const [bookId, chapterMap] of Object.entries(books)) {
    const outChapters = {};
    for (const [chapter, verseMap] of Object.entries(chapterMap)) {
      const outVerses = {};
      for (const [verse, text] of Object.entries(verseMap)) {
        outVerses[verse] = zhHansToHant(String(text));
      }
      outChapters[chapter] = outVerses;
    }
    out[bookId] = outChapters;
  }
  return out;
}

function writeUpload(id, books) {
  const payload = { format: SELAH_FORMAT, books };
  const body = `${JSON.stringify(payload)}\n`;
  const outPath = path.join(UPLOADS_DIR, `${id}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, "utf8");
  return { bytes: Buffer.byteLength(body, "utf8"), sourceFile: `uploads/${id}.json` };
}

function upsertTranslationsIndex(records) {
  const now = new Date().toISOString();
  const index = fs.existsSync(INDEX_PATH)
    ? JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"))
    : { translations: [], defaultTranslationId: "cuv-simp" };
  const byId = new Map((index.translations || []).map((t) => [String(t.id), t]));

  for (const rec of records) {
    byId.set(rec.id, {
      ...(byId.get(rec.id) || {}),
      id: rec.id,
      labelZh: rec.labelZh,
      labelEn: rec.labelEn,
      language: rec.language,
      sourceFile: rec.sourceFile,
      updatedAt: now,
      bytes: rec.bytes,
      verseCount: rec.verseCount,
    });
  }

  const translations = Array.from(byId.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const defaultTranslationId = translations.some((t) => t.id === "cuv-simp")
    ? "cuv-simp"
    : String(index.defaultTranslationId || translations[0]?.id || "");

  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(
    INDEX_PATH,
    `${JSON.stringify({ translations, defaultTranslationId }, null, 2)}\n`,
    "utf8",
  );
}

function main() {
  prepareOpenBibleCheckout();

  const imported = [];
  for (const job of LANGUAGE_JOBS) {
    const { books, verseCount } = collectLocaleBooks(job.localeDir);
    const { bytes, sourceFile } = writeUpload(job.outId, books);
    imported.push({
      id: job.outId,
      labelZh: job.outId === "otb-en-gb" ? "Open Bible 英文版" : "Open Bible 简体中文",
      labelEn:
        job.outId === "otb-en-gb"
          ? "Open Translation Bible (English, en-GB)"
          : "Open Translation Bible (Chinese Simplified, zh-CN)",
      language: job.outId === "otb-en-gb" ? "en" : "zh-Hans",
      sourceFile,
      bytes,
      verseCount,
    });

    if (job.outId === "otb-zh-hans") {
      const booksZhHant = convertZhHansBooksToHant(books);
      const zhHantWrite = writeUpload("otb-zh-hant", booksZhHant);
      imported.push({
        id: "otb-zh-hant",
        labelZh: "Open Bible 繁體中文（由简体自动转换）",
        labelEn: "Open Translation Bible (Chinese Traditional, auto-converted from zh-CN)",
        language: "zh-Hant",
        sourceFile: zhHantWrite.sourceFile,
        bytes: zhHantWrite.bytes,
        verseCount,
      });
    }
  }

  upsertTranslationsIndex(imported);
  console.log(`Imported OTB translations: ${imported.map((x) => x.id).join(", ")}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
