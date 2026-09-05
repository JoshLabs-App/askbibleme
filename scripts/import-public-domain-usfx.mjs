#!/usr/bin/env node
/**
 * 拉取公开可分发译本 USFX，并转换为 Selah `selah-bible-v1` JSON。
 *
 * 输出：
 * - data/bible/uploads/<id>.json
 * - data/bible/translations.json（仅对 JOBS 中条目做 upsert；不会删除现有其它译本）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const BIBLE_DIR = path.join(REPO_ROOT, "data", "bible");
const UPLOADS_DIR = path.join(BIBLE_DIR, "uploads");
const INDEX_PATH = path.join(BIBLE_DIR, "translations.json");
const TMP_DIR = path.join(os.tmpdir(), "askbible-public-domain-usfx");
const SELAH_FORMAT = "selah-bible-v1";

const BOOKS = [
  { id: "GEN", chapters: 50 },
  { id: "EXO", chapters: 40 },
  { id: "LEV", chapters: 27 },
  { id: "NUM", chapters: 36 },
  { id: "DEU", chapters: 34 },
  { id: "JOS", chapters: 24 },
  { id: "JDG", chapters: 21 },
  { id: "RUT", chapters: 4 },
  { id: "1SA", chapters: 31 },
  { id: "2SA", chapters: 24 },
  { id: "1KI", chapters: 22 },
  { id: "2KI", chapters: 25 },
  { id: "1CH", chapters: 29 },
  { id: "2CH", chapters: 36 },
  { id: "EZR", chapters: 10 },
  { id: "NEH", chapters: 13 },
  { id: "EST", chapters: 10 },
  { id: "JOB", chapters: 42 },
  { id: "PSA", chapters: 150 },
  { id: "PRO", chapters: 31 },
  { id: "ECC", chapters: 12 },
  { id: "SNG", chapters: 8 },
  { id: "ISA", chapters: 66 },
  { id: "JER", chapters: 52 },
  { id: "LAM", chapters: 5 },
  { id: "EZK", chapters: 48 },
  { id: "DAN", chapters: 12 },
  { id: "HOS", chapters: 14 },
  { id: "JOL", chapters: 3 },
  { id: "AMO", chapters: 9 },
  { id: "OBA", chapters: 1 },
  { id: "JON", chapters: 4 },
  { id: "MIC", chapters: 7 },
  { id: "NAM", chapters: 3 },
  { id: "HAB", chapters: 3 },
  { id: "ZEP", chapters: 3 },
  { id: "HAG", chapters: 2 },
  { id: "ZEC", chapters: 14 },
  { id: "MAL", chapters: 4 },
  { id: "MAT", chapters: 28 },
  { id: "MRK", chapters: 16 },
  { id: "LUK", chapters: 24 },
  { id: "JHN", chapters: 21 },
  { id: "ACT", chapters: 28 },
  { id: "ROM", chapters: 16 },
  { id: "1CO", chapters: 16 },
  { id: "2CO", chapters: 13 },
  { id: "GAL", chapters: 6 },
  { id: "EPH", chapters: 6 },
  { id: "PHP", chapters: 4 },
  { id: "COL", chapters: 4 },
  { id: "1TH", chapters: 5 },
  { id: "2TH", chapters: 3 },
  { id: "1TI", chapters: 6 },
  { id: "2TI", chapters: 4 },
  { id: "TIT", chapters: 3 },
  { id: "PHM", chapters: 1 },
  { id: "HEB", chapters: 13 },
  { id: "JAS", chapters: 5 },
  { id: "1PE", chapters: 5 },
  { id: "2PE", chapters: 3 },
  { id: "1JN", chapters: 5 },
  { id: "2JN", chapters: 1 },
  { id: "3JN", chapters: 1 },
  { id: "JUD", chapters: 1 },
  { id: "REV", chapters: 22 },
];

const JOBS = [
  {
    id: "asv",
    url: "https://eBible.org/Scriptures/eng-asv_usfx.zip",
    labelZh: "ASV 英文标准本",
    labelEn: "American Standard Version (ASV)",
    language: "en",
  },
  {
    id: "kjv",
    url: "https://eBible.org/Scriptures/eng-kjv2006_usfx.zip",
    labelZh: "KJV 英文钦定本",
    labelEn: "King James Version (KJV)",
    language: "en",
  },
  {
    id: "ylt-en",
    url: "https://eBible.org/Scriptures/engylt_usfx.zip",
    labelZh: "YLT 杨氏直译本",
    labelEn: "Young's Literal Translation (YLT)",
    language: "en",
  },
  {
    id: "dby-en",
    url: "https://eBible.org/Scriptures/engDBY_usfx.zip",
    labelZh: "Darby 英译本",
    labelEn: "Darby Translation",
    language: "en",
  },
  {
    id: "gnv-en",
    url: "https://eBible.org/Scriptures/enggnv_usfx.zip",
    labelZh: "Geneva 1599 英译本",
    labelEn: "Geneva Bible 1599",
    language: "en",
  },
  {
    id: "swcb-zh",
    url: "https://eBible.org/Scriptures/cmnswcb_usfx.zip",
    labelZh: "世界中文圣经",
    labelEn: "World Chinese Bible",
    language: "zh-Hans",
  },
  {
    id: "cbs-zh",
    url: "https://eBible.org/Scriptures/cmncbs_usfx.zip",
    labelZh: "中文当代译本（简体）",
    labelEn: "Mandarin Chinese Open Contemporary Bible (Simplified)",
    language: "zh-Hans",
  },
  {
    id: "rvg-es",
    url: "https://eBible.org/Scriptures/sparvg_usfx.zip",
    labelZh: "西班牙语 RVG",
    labelEn: "Reina Valera Gomez (Spanish)",
    language: "es",
  },
  {
    id: "blm-es",
    url: "https://eBible.org/Scriptures/spablm_usfx.zip",
    labelZh: "西班牙语 自由世界圣经",
    labelEn: "Spanish Free Bible for the World",
    language: "es",
  },
];

function stripXml(text) {
  return String(text || "")
    .replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, " ")
    .replace(/<x\b[^>]*>[\s\S]*?<\/x>/g, " ")
    .replace(/<fig\b[^>]*>[\s\S]*?<\/fig>/g, " ")
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, " ")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAllVerses(xml, bookCode) {
  const bookRe = new RegExp(
    `<book\\b[^>]*id="${bookCode}"[^>]*>([\\s\\S]*?)(?=<book\\b[^>]*id="[^"]+"[^>]*>|<\\/usfx>|$)`,
    "i",
  );
  const bookMatch = xml.match(bookRe);
  if (!bookMatch) return [];
  const bookBody = bookMatch[1];
  const chapterRe = /<c\b[^>]*id="(\d+)"[^>]*\/>[\s\S]*?(?=<c\b[^>]*id="\d+"[^>]*\/>|$)/gi;
  const verseRe1 = /<v\b[^>]*id="(\d+)"[^>]*\/>([\s\S]*?)<ve\s*\/>/g;
  const verseRe2 = /<v\b[^>]*id="(\d+)"[^>]*\/>([\s\S]*?)(?=<v\b[^>]*id="\d+"[^>]*\/>|$)/g;
  const rows = [];
  let chapterMatch;
  while ((chapterMatch = chapterRe.exec(bookBody)) !== null) {
    const chapter = Number(chapterMatch[1]);
    const chunk = chapterMatch[0];
    let verseMatch;
    let foundVe = false;
    while ((verseMatch = verseRe1.exec(chunk)) !== null) {
      foundVe = true;
      const verse = Number(verseMatch[1]);
      const t = stripXml(verseMatch[2]);
      if (t) rows.push({ chapter, verse, text: t });
    }
    if (!foundVe) {
      while ((verseMatch = verseRe2.exec(chunk)) !== null) {
        const verse = Number(verseMatch[1]);
        const t = stripXml(verseMatch[2]);
        if (t) rows.push({ chapter, verse, text: t });
      }
    }
    verseRe1.lastIndex = 0;
    verseRe2.lastIndex = 0;
  }
  return rows;
}

function buildBooksFromXml(xml) {
  const books = {};
  let verseCount = 0;
  const missing = [];
  for (const { id: bookId } of BOOKS) {
    const rows = extractAllVerses(xml, bookId);
    if (rows.length === 0) {
      missing.push(bookId);
      continue;
    }
    const byCh = {};
    for (const { chapter, verse, text } of rows) {
      const ck = String(chapter);
      const vk = String(verse);
      if (!byCh[ck]) byCh[ck] = {};
      byCh[ck][vk] = text;
      verseCount += 1;
    }
    books[bookId] = byCh;
  }
  return { books, verseCount, missing };
}

async function downloadZip(url, outPath) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (AskBible import script)",
      accept: "application/zip,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`下载失败 (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
}

function readUsfxXmlFromZip(zipPath) {
  const entriesRaw = execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const entries = entriesRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const xmlEntry =
    entries.find((p) => p.toLowerCase().includes("usfx") && p.toLowerCase().endsWith(".xml")) ??
    entries.find((p) => p.toLowerCase().endsWith("_usfx.xml")) ??
    entries.find((p) => p.toLowerCase().endsWith(".usfx")) ??
    entries.find((p) => p.toLowerCase().endsWith(".xml"));
  if (!xmlEntry) {
    throw new Error(`zip 中未找到 XML: ${zipPath}`);
  }
  return execFileSync("unzip", ["-p", zipPath, xmlEntry], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function writeTranslationFile(id, payload) {
  const finalPath = path.join(UPLOADS_DIR, `${id}.json`);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const body = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(finalPath, body, "utf8");
  return {
    path: finalPath,
    bytes: Buffer.byteLength(body, "utf8"),
  };
}

function upsertTranslationsIndex(records) {
  const now = new Date().toISOString();
  let index = { translations: [], defaultTranslationId: "cuv-simp" };
  if (fs.existsSync(INDEX_PATH)) {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  }

  const byId = new Map((index.translations || []).map((t) => [String(t.id), t]));
  for (const rec of records) {
    byId.set(rec.id, {
      ...(byId.get(rec.id) || {}),
      id: rec.id,
      labelZh: rec.labelZh,
      labelEn: rec.labelEn,
      language: rec.language,
      sourceFile: `uploads/${rec.id}.json`,
      updatedAt: now,
      bytes: rec.bytes,
      verseCount: rec.verseCount,
    });
  }

  const translations = Array.from(byId.values()).sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );
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

async function main() {
  const imported = [];
  for (const job of JOBS) {
    const zipPath = path.join(TMP_DIR, `${job.id}.usfx.zip`);
    console.log(`Downloading ${job.id} from ${job.url}`);
    await downloadZip(job.url, zipPath);
    const xml = readUsfxXmlFromZip(zipPath);
    const { books, verseCount, missing } = buildBooksFromXml(xml);
    if (missing.length) {
      console.warn(`[${job.id}] missing books: ${missing.join(", ")}`);
    }
    const payload = { format: SELAH_FORMAT, books };
    const { bytes } = writeTranslationFile(job.id, payload);
    imported.push({
      id: job.id,
      labelZh: job.labelZh,
      labelEn: job.labelEn,
      language: job.language,
      bytes,
      verseCount,
    });
    console.log(`[${job.id}] verses=${verseCount}, bytes=${bytes}`);
  }

  upsertTranslationsIndex(imported);
  console.log(`Updated ${INDEX_PATH}`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
