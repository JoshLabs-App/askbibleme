#!/usr/bin/env node
/**
 * 导入 unfoldingWord® Simplified Text（UST，前身 UDB）为 Selah `selah-bible-v1` JSON。
 *
 * 来源：https://git.door43.org/unfoldingWord/en_ust
 * - USFM 3.0，一卷一个文件（NN-BOOK.usfm），正文带 \zaln-s/\zaln-e 与 \w 词对齐标记。
 * - 默认取正式发布 tag（环境变量 UST_REF，默认 v90）。正式版只含已定稿书卷（v90 为 56 卷），
 *   master 上未发布的书卷是修订中 / AI 初稿且不完整，不导入。
 * - 授权 CC BY-SA 4.0：正文一字不改（保留 { } 隐含信息花括号与 [ ] 存疑经文方括号），
 *   只剥掉 USFM 标记、脚注与对齐数据。
 *
 * 输出：
 * - data/bible/uploads/ust-en.json
 * - data/bible/translations.json（仅 upsert ust-en）
 *
 * 用法：
 *   npm run import:bible:ust
 *   UST_REF=v91 npm run import:bible:ust
 *   UST_SOURCE_DIR=/path/to/en_ust npm run import:bible:ust   # 复用本机已有 checkout，不再 clone
 *
 * 之后：BIBLE_TRANSLATION_ID=ust-en npm run build:bible-sqlite
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
const SELAH_FORMAT = "selah-bible-v1";

const UST_REPO = "https://git.door43.org/unfoldingWord/en_ust.git";
const UST_REF = String(process.env.UST_REF || "v90").trim();
const TMP_ROOT = path.join(os.tmpdir(), "askbible-unfoldingword-ust");
const CHECKOUT_DIR = path.join(TMP_ROOT, `en_ust-${UST_REF}`);

const TRANSLATION = {
  id: "ust-en",
  labelZh: "UST 简明英文（学英文版）",
  labelEn: "unfoldingWord Simplified Text (UST) – Learn English",
  language: "en",
  copyright: `unfoldingWord® Simplified Text ${UST_REF}. Copyright © 2022 by unfoldingWord. Licensed under CC BY-SA 4.0.`,
  publisherUrl: "https://www.unfoldingword.org/ust",
};

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

/** 段落类标记：换段不换节，后续正文仍归入当前节。 */
const PARAGRAPH_MARKERS = new Set([
  "p", "m", "mi", "nb", "pc", "pr", "pm", "pmo", "pmc", "pmr", "cls", "po",
  "pi", "pi1", "pi2", "pi3",
  "q", "q1", "q2", "q3", "q4", "qr", "qc", "qm", "qm1", "qm2", "qm3",
  "b", "li", "li1", "li2", "li3", "li4", "lim", "lim1", "lim2", "lh", "lf", "ph", "ph1",
]);

/** 字符样式标记（可能独占一行，如 `\qs Selah\qs*`）：按正文续行处理，标记本身在 cleanVerseText 里剥掉。 */
const CHAR_STYLE_MARKERS = new Set([
  "qs", "nd", "bk", "tl", "wj", "add", "addpn", "sc", "it", "bd", "bdit", "em", "pn", "png", "k", "sls",
  "no", "sup", "ord", "ndx", "rb", "pro", "dc", "qt", "sig", "lik", "liv", "liv1", "litl", "jmp", "fig",
]);

/** 标题 / 说明类标记：不属于任何一节，整段丢弃直到下一个结构标记。 */
const HEADING_MARKERS = new Set([
  "id", "ide", "usfm", "h", "h1", "h2", "h3", "toc1", "toc2", "toc3", "toca1", "toca2", "toca3",
  "rem", "sts", "mt", "mt1", "mt2", "mt3", "mt4", "mte", "mte1", "mte2",
  "ms", "ms1", "ms2", "ms3", "mr", "s", "s1", "s2", "s3", "s4", "s5", "sr", "r",
  "d", "sp", "qa", "qd", "cl", "cd", "ca", "cp", "va", "vp",
  "ip", "ipi", "im", "imi", "ipq", "imq", "ipr", "iq", "iq1", "iq2", "ib", "ili", "ili1", "ili2",
  "iot", "io", "io1", "io2", "io3", "ior", "iex", "imt", "imt1", "imt2", "imte", "is", "is1", "is2", "ie",
  "periph", "pb", "esb", "esbe", "cat", "tr", "th1", "th2", "th3", "tc1", "tc2", "tc3", "thr1", "tcr1", "lit",
]);

/** 去掉词对齐、脚注、里程碑等非正文数据；保留结构标记与字符样式内文。 */
function stripAlignmentMarkup(raw) {
  return (
    String(raw)
      .replace(/\r\n?/g, "\n")
      // \zaln-s |attrs\* … \zaln-e\*
      .replace(/\\zaln-s\s*\|[\s\S]*?\\\*/g, "")
      .replace(/\\zaln-e\\\*/g, "")
      // \w word|attrs\w* → word（含 \+w 嵌套写法）
      .replace(/\\\+?w\s+([\s\S]*?)(?:\|[\s\S]*?)?\\\+?w\*/g, "$1")
      // 脚注 / 尾注 / 串珠整体丢弃
      .replace(/\\f\s[\s\S]*?\\f\*/g, "")
      .replace(/\\fe\s[\s\S]*?\\fe\*/g, "")
      .replace(/\\x\s[\s\S]*?\\x\*/g, "")
      // 其余里程碑：\ts\*、\k-s |…\*、\k-e\*、\qt-s …\*
      .replace(/\\[a-z]+(?:-[se])?\s*(?:\|[^\\]*?)?\\\*/g, "")
      // 章 / 节标记统一挪到行首，便于逐行解析（\q2 \v 4 … 这类行内写法）
      .replace(/[ \t]*\\c\s+(?=\d)/g, "\n\\c ")
      .replace(/[ \t]*\\v\s+(?=\d)/g, "\n\\v ")
      // 行内标题标记（\v 1 \d 诗篇题记 … 这类写法）同样挪到行首，按标题丢弃
      .replace(/[ \t]*\\(d|s|s1|s2|s3|s4|s5|sp|qa|r|sr|ms|ms1|mr|cl)(?=\s)/g, "\n\\$1")
  );
}

/** 节内正文收尾：去掉残留字符样式标记，规整空白与标点间距。正文字词不改。 */
function cleanVerseText(s) {
  return String(s)
    .replace(/\\\+?[a-z]+\d*\*/g, "")
    .replace(/\\\+?[a-z]+\d*\s*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\{\s+/g, "{")
    .replace(/\s+\}/g, "}")
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .replace(/\s+([,.;:!?”’)])/g, "$1")
    .replace(/([(“‘])\s+/g, "$1")
    .trim();
}

function parseUsfmBook(raw, bookId) {
  const text = stripAlignmentMarkup(raw);
  /** @type {Record<string, Record<string, string>>} */
  const chapters = {};
  const warnings = [];
  const bridged = [];
  let chapter = 0;
  let verse = 0;
  let dropping = true;
  /** @type {string[] | null} */
  let buf = null;

  const flush = () => {
    if (buf && chapter > 0 && verse > 0) {
      const t = cleanVerseText(buf.join(" "));
      if (t) {
        const ck = String(chapter);
        const vk = String(verse);
        if (!chapters[ck]) chapters[ck] = {};
        chapters[ck][vk] = chapters[ck][vk] ? `${chapters[ck][vk]} ${t}` : t;
      }
    }
    buf = null;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^\\(\+?[a-z]+\d*)(?:\s+([\s\S]*))?$/);
    if (!m) {
      if (!dropping && buf) buf.push(line);
      continue;
    }
    const marker = m[1];
    const rest = (m[2] || "").trim();

    if (marker === "c") {
      flush();
      const n = Number.parseInt(rest, 10);
      if (!Number.isInteger(n) || n <= 0) {
        warnings.push(`${bookId}: bad chapter marker "\\c ${rest}"`);
        dropping = true;
        continue;
      }
      chapter = n;
      verse = 0;
      dropping = false;
      continue;
    }

    if (marker === "v") {
      flush();
      const vm = rest.match(/^(\d+)(?:[-–,](\d+))?[a-z]?\s*([\s\S]*)$/);
      if (!vm || chapter === 0) {
        warnings.push(`${bookId} ${chapter}: bad verse marker "\\v ${rest.slice(0, 20)}"`);
        dropping = true;
        continue;
      }
      verse = Number(vm[1]);
      if (vm[2]) bridged.push(`${bookId} ${chapter}:${vm[1]}-${vm[2]}`);
      dropping = false;
      buf = [];
      if (vm[3]) buf.push(vm[3]);
      continue;
    }

    if (CHAR_STYLE_MARKERS.has(marker)) {
      if (!dropping && buf) buf.push(line);
      continue;
    }

    if (PARAGRAPH_MARKERS.has(marker)) {
      dropping = false;
      if (rest && buf) buf.push(rest);
      continue;
    }

    if (HEADING_MARKERS.has(marker)) {
      dropping = true;
      continue;
    }

    // 未知标记：按标题处理并告警，避免把非经文内容混入节文。
    warnings.push(`${bookId} ${chapter}:${verse}: unknown marker \\${marker}`);
    dropping = true;
  }
  flush();

  return { chapters, warnings, bridged };
}

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, stdio: "inherit", maxBuffer: 64 * 1024 * 1024 });
}

function prepareSourceDir() {
  const custom = String(process.env.UST_SOURCE_DIR || "").trim();
  if (custom) {
    const abs = path.resolve(custom);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      throw new Error(`UST_SOURCE_DIR 不存在: ${abs}`);
    }
    console.log(`Using existing checkout: ${abs}`);
    return abs;
  }
  fs.rmSync(CHECKOUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  console.log(`Cloning ${UST_REPO} @ ${UST_REF} → ${CHECKOUT_DIR}`);
  run("git", ["clone", "--depth=1", "--branch", UST_REF, UST_REPO, CHECKOUT_DIR], TMP_ROOT);
  return CHECKOUT_DIR;
}

function findBookFile(sourceDir, bookId) {
  const files = fs.readdirSync(sourceDir);
  const re = new RegExp(`^\\d{2}-${bookId}\\.usfm$`, "i");
  const hit = files.find((f) => re.test(f));
  return hit ? path.join(sourceDir, hit) : null;
}

function writeTranslationFile(id, payload) {
  const finalPath = path.join(UPLOADS_DIR, `${id}.json`);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const body = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(finalPath, body, "utf8");
  return { path: finalPath, bytes: Buffer.byteLength(body, "utf8") };
}

function upsertTranslationsIndex(rec) {
  const now = new Date().toISOString();
  let index = { translations: [], defaultTranslationId: "cuv-simp" };
  if (fs.existsSync(INDEX_PATH)) {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  }
  const byId = new Map((index.translations || []).map((t) => [String(t.id), t]));
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
    copyright: rec.copyright,
    publisherUrl: rec.publisherUrl,
  });
  const translations = Array.from(byId.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const defaultTranslationId = translations.some((t) => t.id === "cuv-simp")
    ? "cuv-simp"
    : String(index.defaultTranslationId || translations[0]?.id || "");
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, `${JSON.stringify({ translations, defaultTranslationId }, null, 2)}\n`, "utf8");
}

function main() {
  const sourceDir = prepareSourceDir();
  const books = {};
  const missing = [];
  const chapterMismatch = [];
  const warnings = [];
  const bridged = [];
  let verseCount = 0;

  for (const { id: bookId, chapters: expectedChapters } of BOOKS) {
    const file = findBookFile(sourceDir, bookId);
    if (!file) {
      missing.push(bookId);
      continue;
    }
    const raw = fs.readFileSync(file, "utf8");
    const idLine = raw.match(/^\\id\s+([A-Z0-9]{3})/m);
    if (idLine && idLine[1] !== bookId) {
      throw new Error(`${path.basename(file)}: \\id ${idLine[1]} 与文件名书卷 ${bookId} 不一致`);
    }
    const parsed = parseUsfmBook(raw, bookId);
    const chapterKeys = Object.keys(parsed.chapters);
    if (chapterKeys.length === 0) {
      missing.push(bookId);
      continue;
    }
    const maxChapter = Math.max(...chapterKeys.map(Number));
    if (maxChapter !== expectedChapters || chapterKeys.length !== expectedChapters) {
      chapterMismatch.push(`${bookId}: ${chapterKeys.length} chapters (max ${maxChapter}), expected ${expectedChapters}`);
    }
    for (const ch of chapterKeys) verseCount += Object.keys(parsed.chapters[ch]).length;
    books[bookId] = parsed.chapters;
    warnings.push(...parsed.warnings);
    bridged.push(...parsed.bridged);
  }

  if (Object.keys(books).length === 0) {
    throw new Error(`未解析到任何书卷: ${sourceDir}`);
  }

  const { bytes } = writeTranslationFile(TRANSLATION.id, { format: SELAH_FORMAT, books });
  upsertTranslationsIndex({ ...TRANSLATION, bytes, verseCount });

  console.log(`[${TRANSLATION.id}] ref=${UST_REF} books=${Object.keys(books).length}/${BOOKS.length} verses=${verseCount} bytes=${bytes}`);
  if (missing.length) console.warn(`[${TRANSLATION.id}] missing books (${missing.length}): ${missing.join(", ")}`);
  if (chapterMismatch.length) console.warn(`[${TRANSLATION.id}] chapter count mismatch:\n  ${chapterMismatch.join("\n  ")}`);
  if (bridged.length) console.warn(`[${TRANSLATION.id}] bridged verses (${bridged.length}, text kept under first verse): ${bridged.join(", ")}`);
  if (warnings.length) console.warn(`[${TRANSLATION.id}] warnings (${warnings.length}):\n  ${warnings.slice(0, 40).join("\n  ")}`);
  console.log(`Updated ${INDEX_PATH}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
