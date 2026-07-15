#!/usr/bin/env node
/**
 * 从桌面「01 AskBible 2」的 USFX XML 生成 Selah `selah-bible-v1` JSON（data/bible/uploads）。
 *
 * 导入版本（与 AskBible `admin_data/scripture_versions.json` 中 USFX 一致）：
 *   cuv-simp, cuv-trad, bbe-en, rv1909-es, heb-leningrad
 *
 * WEBP (`web-en`) uses the official current source and is imported separately
 * with `npm run bible:import:webp`, so this legacy importer cannot overwrite it.
 *
 * 希伯来来源文件将 SOS/JOE/EZE/NAH 映射为 SNG/JOL/EZK/NAM；该 USFX 不含以斯帖（EST），故希伯来 JSON 无此书。
 * 西语 RV1909 使用 `<ve />` 闭合标签，解析器已兼容。
 *
 * 默认源目录：环境变量 ASKBIBLE_REPO，或 ~/Desktop/APP/01 AskBible 2
 *
 * 用法：node scripts/import-askbible-usfx.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { normalizeCuvSimplifiedOrthography } from "../lib/bible/cuv-simplified-orthography.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

/** 希伯来 Leningrad USFX 内书卷 id 与 canonical OSIS 不一致时的映射（输出键仍为 canonical） */
const HEBREW_XML_BOOK_SOURCE = {
  SNG: "SOS",
  JOL: "JOE",
  EZK: "EZE",
  NAM: "NAH",
};

const OT_BOOK_IDS = new Set(BOOKS.slice(0, 39).map((b) => b.id));

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
  /** 部分译本（如西语 RV1909）使用 `<ve />` 带空格 */
  const verseRe1 = /<v\b[^>]*id="(\d+)"[^>]*\/>([\s\S]*?)<ve\s*\/>/g;
  const verseRe2 = /<v\b[^>]*id="(\d+)"[^>]*\/>([\s\S]*?)(?=<v\b[^>]*id="\d+"[^>]*\/>|$)/g;
  const rows = [];
  let chapterMatch;
  while ((chapterMatch = chapterRe.exec(bookBody)) !== null) {
    const chapter = Number(chapterMatch[1]);
    const chunk = chapterMatch[0];
    let verseMatch;
    let found = false;
    while ((verseMatch = verseRe1.exec(chunk)) !== null) {
      found = true;
      const verse = Number(verseMatch[1]);
      const t = stripXml(verseMatch[2]);
      if (t) rows.push({ chapter, verse, text: t });
    }
    if (!found) {
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

function defaultAskBibleRoot() {
  const env = process.env.ASKBIBLE_REPO?.trim();
  if (env) return path.resolve(env);
  return path.join(os.homedir(), "Desktop", "APP", "01 AskBible 2");
}

function buildBooksFromXml(xml, bookSourceIds = {}) {
  const books = {};
  let verseCount = 0;
  const missing = [];
  for (const { id: bookId } of BOOKS) {
    const xmlBookId = bookSourceIds[bookId] ?? bookId;
    const rows = extractAllVerses(xml, xmlBookId);
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

function writeTranslation(outDir, id, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  const p = path.join(outDir, `${id}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(p, body, "utf8");
  return { path: p, bytes: Buffer.byteLength(body, "utf8") };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const askRoot = defaultAskBibleRoot();
  const dataDir = path.join(askRoot, "data");
  const outUploads = path.join(repoRoot, "data", "bible", "uploads");
  const indexPath = path.join(repoRoot, "data", "bible", "translations.json");

  if (!fs.existsSync(dataDir)) {
    console.error(`找不到 AskBible data 目录：${dataDir}`);
    console.error("请设置 ASKBIBLE_REPO 指向「01 AskBible 2」仓库根目录。");
    process.exit(1);
  }

  /** 与 AskBible 2 `admin_data/scripture_versions.json` 中 USFX 条目一致（略去 OSIS 等其它格式） */
  const jobs = [
    {
      id: "cuv-simp",
      xmlFile: "chi-cuv-simp.usfx.xml",
      labelZh: "和合本（简体）",
      labelEn: "Chinese Union Version (Simplified)",
      language: "zh-Hans",
    },
    {
      id: "cuv-trad",
      xmlFile: "chi-cuv.usfx.xml",
      labelZh: "和合本（繁體）",
      labelEn: "Chinese Union Version (Traditional)",
      language: "zh-Hant",
    },
    {
      id: "bbe-en",
      xmlFile: "eng-bbe.usfx.xml",
      labelZh: "BBE 简易英文",
      labelEn: "Bible in Basic English (BBE)",
      language: "en",
    },
    {
      id: "rv1909-es",
      xmlFile: "spa-rv1909.usfx.xml",
      labelZh: "西班牙语 Reina-Valera 1909",
      labelEn: "Reina-Valera 1909 (Spanish)",
      language: "es",
    },
    {
      id: "heb-leningrad",
      xmlFile: "heb-leningrad.usfx.xml",
      labelZh: "希伯来语 · Leningrad Codex",
      labelEn: "Hebrew (Leningrad / WLC-style)",
      language: "he",
    },
  ];

  const now = new Date().toISOString();
  const translations = [];

  for (const job of jobs) {
    const xmlPath = path.join(dataDir, job.xmlFile);
    if (!fs.existsSync(xmlPath)) {
      console.error(`跳过（文件不存在）：${xmlPath}`);
      continue;
    }
    console.log(`读取 ${xmlPath} …`);
    const xml = fs.readFileSync(xmlPath, "utf8");
    const bookSourceIds = job.id === "heb-leningrad" ? HEBREW_XML_BOOK_SOURCE : {};
    const { books, verseCount, missing } = buildBooksFromXml(xml, bookSourceIds);
    if (job.id === "cuv-simp") {
      for (const chapters of Object.values(books)) {
        for (const verses of Object.values(chapters)) {
          for (const [verse, text] of Object.entries(verses)) {
            verses[verse] = normalizeCuvSimplifiedOrthography(text);
          }
        }
      }
    }
    const missingWarn =
      job.id === "heb-leningrad" ? missing.filter((id) => OT_BOOK_IDS.has(id)) : missing;
    if (missingWarn.length) {
      console.warn(`  警告：以下书卷未解析到经文（可能 XML 结构不同或源文件无此书）：${missingWarn.join(", ")}`);
    }
    const payload = { format: SELAH_FORMAT, books };
    const { bytes } = writeTranslation(outUploads, job.id, payload);
    translations.push({
      id: job.id,
      labelZh: job.labelZh,
      labelEn: job.labelEn,
      language: job.language,
      sourceFile: `uploads/${job.id}.json`,
      updatedAt: now,
      bytes,
      verseCount,
    });
    console.log(`  → uploads/${job.id}.json  ${verseCount} 节  ${(bytes / (1024 * 1024)).toFixed(2)} MB`);
  }

  translations.sort((a, b) => a.id.localeCompare(b.id));
  const index = {
    translations,
    defaultTranslationId: translations.some((t) => t.id === "cuv-simp") ? "cuv-simp" : translations[0]?.id ?? null,
  };
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`已写入 ${indexPath}`);
}

main();
