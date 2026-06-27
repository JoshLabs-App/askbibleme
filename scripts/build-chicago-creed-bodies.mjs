/**
 * Builds Chicago Statement bodies (inerrancy 1978, hermeneutics 1982).
 *
 * Policy (中文正文):
 *   有出版/OCAC 资料 → 直接用资料；无资料的部分 → 从官方英文翻译补全。
 *
 * EN: defendinginerrancy.com/chicago-statements/
 *
 * ZH sources:
 * | Section              | Inerrancy (1978)              | Hermeneutics (1982)           |
 * |----------------------|------------------------------|-------------------------------|
 * | 前言 / 序言          | OCAC PDF                     | OCAC PDF                      |
 * | 宣言概要             | OCAC PDF                     | —                             |
 * | 解释说明 (Exposition)| jidujiaojiaoyu (吕沛渊); PDF无 | EN→ZH (无出版译本)            |
 * | 确认与否认条文       | OCAC PDF                     | OCAC PDF                      |
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import {
  cleanupHistoricalCreedEnglishText,
  normalizeHistoricalCreedChineseText,
} from "../lib/explore/historical-creeds-text-cleanup.mjs";

/** @typedef {{ published: string; translated?: string }} ZhSectionSources */

const ZH_SECTION_SOURCES = {
  inerrancy: {
    preface: "OCAC PDF (ochopechurch.org R1)",
    shortStatement: "OCAC PDF",
    exposition: "jidujiaojiaoyu.org 吕沛渊 (OCAC PDF 未收录)",
    articles: "OCAC PDF",
  },
  hermeneutics: {
    preface: "OCAC PDF",
    exposition: "EN translated — chicago-hermeneutics-exposition-zh-from-en.json (无出版译本)",
    articles: "OCAC PDF",
  },
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../lib/explore/historical-creeds-bodies");
const sourcesDir = path.join(outDir, "sources");
const extractPdfScript = path.join(__dirname, "extract-pdf-text.py");

const URLS = {
  enCombined: "https://defendinginerrancy.com/chicago-statements/",
  zhInerrancyPdf:
    "https://ochopechurch.org/wp-content/uploads/2022/01/%E8%8A%9D%E5%8A%A0%E5%93%A5%E5%9C%A3%E7%BB%8F%E6%97%A0%E8%AF%AF%E5%AE%A3%E8%A8%80-R1.pdf",
  zhHermeneuticsPdf:
    "https://ochopechurch.org/wp-content/uploads/2022/01/%E8%8A%9D%E5%8A%A0%E5%93%A5%E5%9C%A3%E7%BB%8F%E8%A7%A3%E9%87%8A%E5%AE%A3%E8%A8%80-R1.pdf",
  zhInerrancyExposition:
    "https://jidujiaojiaoyu.org/%e8%8a%9d%e5%8a%a0%e5%93%a5%e5%9c%a3%e7%bb%8f%e6%97%a0%e8%af%af%e5%ae%a3%e8%a8%80-csbi-1978/",
};

function curl(url) {
  return execSync(`curl -sL "${url}"`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function curlBinary(url, dest) {
  execSync(`curl -sL "${url}" -o "${dest}"`, { maxBuffer: 20 * 1024 * 1024 });
}

function extractPdfText(pdfPath, txtPath) {
  try {
    execSync(`python3 "${extractPdfScript}" "${pdfPath}" "${txtPath}"`, {
      stdio: "pipe",
    });
    return fs.readFileSync(txtPath, "utf8");
  } catch {
    if (fs.existsSync(txtPath)) {
      console.warn(`  PDF extract failed; using cached ${path.basename(txtPath)}`);
      return fs.readFileSync(txtPath, "utf8");
    }
    throw new Error(
      `Could not extract ${pdfPath}. Install pypdf: pip install --break-system-packages pypdf`,
    );
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "");
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

function splitParagraphs(text) {
  return text
    .split(/\n+/)
    .map((p) => normalizeWhitespace(p))
    .filter((p) => p.length > 0);
}

function toTraditional(s) {
  const map = {
    条: "條", 论: "論", 圣: "聖", 独: "獨", 灵: "靈", 万: "萬", 国: "國", 会: "會",
    礼: "禮", 义: "義", 护: "護", 启: "啟", 书: "書", 经: "經", 无: "無", 体: "體",
    复: "復", 来: "來", 们: "們", 这: "這", 为: "為", 与: "與", 对: "對", 时: "时",
    后: "後", 从: "從", 证: "證", 实: "實", 当: "當", 将: "將", 还: "還", 过: "過",
    达: "達", 进: "進", 开: "開", 关: "關", 应: "應", 该: "該", 说: "說", 话: "話",
    语: "語", 读: "讀", 传: "傳", 统: "統", 总: "總", 众: "眾", 虽: "雖", 却: "卻",
    显: "顯", 亲: "親", 尔: "爾", 亚: "亞", 罗: "羅", 马: "馬", 阴: "陰", 间: "間",
    里: "裡", 内: "內", 两: "兩", 个: "個", 拣: "揀", 选: "選", 赎: "贖", 称: "稱",
    责: "責", 据: "據", 祷: "禱", 离: "離", 难: "難", 愿: "願", 气: "氣", 质: "質",
    员: "員", 团: "團", 满: "滿", 准: "準", 确: "確", 种: "種", 类: "類", 处: "處",
    择: "擇", 诉: "訴", 贫: "貧", 穷: "窮", 祸: "禍", 恶: "惡", 击: "擊", 扩: "擴",
    产: "產", 献: "獻", 问: "問", 答: "答", 韦: "韋", 创: "創", 记: "記", 约: "約",
    门: "門", 见: "見", 认: "認", 识: "識", 顺: "順", 从: "從", 绝: "絕", 对: "對",
    权: "權", 威: "威", 误: "誤", 谬: "謬", 释: "釋", 经: "經", 确: "確", 条: "條",
    纲: "綱", 领: "領", 执: "執", 笔: "筆", 写: "寫", 赐: "賜", 救: "救", 赎: "贖",
    审判: "審判", 创造: "創造", 渐进: "漸進", 应: "應", 验: "驗", 规: "規", 范: "範",
    际: "際", 协: "協", 会: "會", 签: "簽", 署: "署", 议: "議", 讨: "討", 论: "論",
    紧: "緊", 凑: "湊", 制: "製", 订: "訂", 签: "簽", 条: "條", 档: "檔", 欢: "歡",
    迎: "迎", 补: "補", 增: "增", 强: "強", 见: "見", 证: "證", 荣耀: "榮耀",
    阿们: "阿們", 创造: "創造", 启示: "啟示", 默示: "默示", 旧约: "舊約", 新约: "新約",
    圣经: "聖經", 上帝: "上帝", 神: "神",
  };
  return s.replace(/[\u4e00-\u9fff]+/g, (chunk) => {
    return [...chunk].map((ch) => map[ch] || ch).join("");
  });
}

function cleanEnParagraphs(paragraphs) {
  return paragraphs.map((p) => cleanupHistoricalCreedEnglishText(p)).filter(Boolean);
}

function cleanZhParagraphs(paragraphs) {
  return paragraphs.map((p) => normalizeHistoricalCreedChineseText(p)).filter(Boolean);
}

function extractBetween(text, startRe, endRe) {
  const start = text.search(startRe);
  if (start < 0) return "";
  const slice = text.slice(start);
  const end = slice.search(endRe);
  return end < 0 ? slice : slice.slice(0, end);
}

const INERRANCY_EXPOSITION_HEADINGS = [
  "Creation, Revelation and Inspiration",
  "Authority: Christ and the Bible",
  "Infallibility, Inerrancy, Interpretation",
  "Skepticism and Criticism",
  "Transmission and Translation",
  "Inerrancy and Authority",
];

const HERMENEUTICS_EXPOSITION_HEADINGS = [
  "Standpoint of the Exposition",
  "The Communion between God and Mankind",
  "The Authority of Scripture",
  "The Holy Spirit and the Scriptures",
  "The Idea of Hermeneutics",
  "The Scope of Biblical Interpretation",
  "Formal Rules of Biblical Interpretation",
  "The Centrality of Jesus Christ in the Biblical Message",
  "Biblical and Extra-biblical Knowledge",
  "Biblical Statements and Natural Science",
  "Norm and Culture in the Biblical Revelation",
  "Encountering God Through His Word",
];

const ROMAN = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18,
  XIX: 19, XX: 20, XXI: 21, XXII: 22, XXIII: 23, XXIV: 24, XXV: 25,
};

function normalizeEnSource(text) {
  return text.replace(/\t+/g, "\n").replace(/\u00a0/g, " ").replace(/\r/g, "");
}

function sliceSection(text, startLabel, endLabel) {
  const start = text.indexOf(startLabel);
  if (start < 0) throw new Error(`Section not found: ${startLabel}`);
  const from = start + startLabel.length;
  const end = endLabel ? text.indexOf(endLabel, from) : -1;
  return (end < 0 ? text.slice(from) : text.slice(from, end)).trim();
}

function sliceInclusive(text, startLabel, endLabel) {
  const start = text.indexOf(startLabel);
  if (start < 0) throw new Error(`Section not found: ${startLabel}`);
  const end = endLabel ? text.indexOf(endLabel, start + startLabel.length) : -1;
  return (end < 0 ? text.slice(start) : text.slice(start, end)).trim();
}

function parseEnCombined(raw) {
  const text = normalizeEnSource(raw);
  const splitAt = text.indexOf("Chicago Statement On Biblical Hermeneutics");
  if (splitAt < 0) throw new Error("Hermeneutics section not found in EN source");
  return {
    inerrancy: parseEnInerrancy(text.slice(0, splitAt)),
    hermeneutics: parseEnHermeneutics(text.slice(splitAt)),
  };
}

function parseEnInerrancy(block) {
  const out = ["Chicago Statement on Biblical Inerrancy (1978)"];

  out.push("Preface");
  out.push(
    ...splitParagraphs(
      sliceInclusive(
        block,
        "The authority of Scripture is a key issue for the Christian church",
        "Short Statement",
      ),
    ),
  );

  out.push("A Short Statement");
  const shortStatement = sliceInclusive(
    block,
    "1. God, who is Himself Truth and speaks truth only",
    "Our understanding of the doctrine of inerrancy must be set",
  ).replace(/(\s*Exposition\s*)+$/i, "");
  out.push(...splitParagraphs(shortStatement));

  out.push("Exposition");
  const exposition = sliceInclusive(
    block,
    "Our understanding of the doctrine of inerrancy must be set",
    "Statement on Biblical Inerrancy",
  );
  out.push(...parseEnExpositionByHeadings(exposition, INERRANCY_EXPOSITION_HEADINGS));

  out.push("Articles of Affirmation and Denial");
  const articles = sliceSection(block, "Articles of Affirmation and Denial", "");
  out.push(...parseEnArticles(articles, 19));

  return cleanEnParagraphs(out);
}

function parseEnHermeneutics(block) {
  const out = ["Chicago Statement on Biblical Hermeneutics (1982)"];

  out.push("Preface");
  out.push(
    ...splitParagraphs(
      sliceSection(block, "Historical Background", "Exposition").replace(/^Historical Background\s*/i, ""),
    ),
  );

  out.push("Exposition");
  const expStart = block.indexOf("Standpoint of the Exposition");
  if (expStart < 0) throw new Error("Hermeneutics exposition not found");
  const expEnd = block.indexOf("Articles of Affirmation and Denial", expStart);
  const expositionBlock = block.slice(expStart, expEnd < 0 ? undefined : expEnd);
  const introStart = block.lastIndexOf("Exposition", expStart);
  const introText = block
    .slice(introStart, expStart)
    .replace(/^Exposition\s*/i, "")
    .trim();
  if (introText && introText !== "Exposition") {
    out.push(...splitParagraphs(introText));
  }
  out.push(...parseEnExpositionByHeadings(expositionBlock, HERMENEUTICS_EXPOSITION_HEADINGS));

  out.push("Articles of Affirmation and Denial");
  const articles = sliceSection(block, "Articles of Affirmation and Denial", "1 See");
  out.push(...parseEnArticles(articles, 25));

  return cleanEnParagraphs(out);
}

function parseEnExpositionByHeadings(text, headings) {
  const out = [];
  const cleaned = text.replace(/^(\s*Exposition\s*\n?)+/i, "").trim();
  const introEnd = cleaned.indexOf(headings[0]);
  if (introEnd > 0) {
    out.push(...splitParagraphs(cleaned.slice(0, introEnd)));
  }
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const start = cleaned.indexOf(heading);
    if (start < 0) throw new Error(`Exposition heading not found: ${heading}`);
    const bodyStart = start + heading.length;
    const bodyEnd =
      i + 1 < headings.length ? cleaned.indexOf(headings[i + 1], bodyStart) : cleaned.length;
    const body = cleaned.slice(bodyStart, bodyEnd).trim();
    out.push(heading);
    out.push(...splitParagraphs(body));
  }
  return out;
}

function parseEnArticles(text, max) {
  const out = [];
  const re = /(?:^|\n)\s*Article\s+([IVXLC]+)\.\s*/g;
  const indices = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    indices.push({ roman: m[1], start: m.index + m[0].length, labelStart: m.index });
  }
  if (indices.length !== max) {
    throw new Error(`Expected ${max} EN articles, got ${indices.length}`);
  }
  for (let i = 0; i < indices.length; i++) {
    const end = i + 1 < indices.length ? indices[i + 1].labelStart : text.length;
    const body = text.slice(indices[i].start, end).trim();
    out.push(formatEnArticle(ROMAN[indices[i].roman] ?? i + 1, body));
  }
  return out;
}

function formatEnArticle(n, body) {
  const t = normalizeWhitespace(body)
    .replace(/\bWE AFFIRM\b/g, "WE AFFIRM")
    .replace(/\bWE DENY\b/g, "\nWE DENY")
    .replace(/\bWe further affirm\b/gi, "\nWe further affirm")
    .replace(/\bWe further deny\b/gi, "\nWe further deny");
  return `Article ${n}\n${t}`;
}

function parseJidujiaojiaoyu(html) {
  const m = html.match(
    /<div class="entry-content[^"]*">([\s\S]*?)<\/div>\s*(?:<footer|<div class="ct-share-box|<aside)/i,
  );
  if (!m) throw new Error("entry-content not found");
  return stripHtml(m[1]);
}

const ZH_ARTICLE_NUMS = [
  "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九",
  "二十", "二十一", "二十二", "二十三", "二十四", "二十五",
];

function cnArticleNum(label) {
  const i = ZH_ARTICLE_NUMS.indexOf(label);
  if (i < 0) throw new Error(`Unknown article label: ${label}`);
  return i + 1;
}

function isOcacNoiseLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^芝加哥圣经(无误|解释)宣言/.test(t)) return true;
  if (/翻译：橡城溪畔/.test(t)) return true;
  if (/^Page \d+/i.test(t)) return true;
  if (/^THE CHICAGO/i.test(t)) return true;
  if (/^BIBLICAL (INERRANCY|HERMENEUTICS)/i.test(t)) return true;
  if (/^(Preface|A SHORT STATEMENT|ARTICLES OF|AFFIRMATION AND DENIAL)$/i.test(t)) return true;
  return false;
}

function isEnglishOcacLine(line) {
  const t = line.trim();
  if (!t) return false;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  if (cjk === 0) return latin > 4;
  return latin > cjk * 3;
}

function stripEnglishTail(line) {
  return line
    .replace(/\s+We\s+(affirm|deny|further|offer|invite|claim|see|affirmation).*$/i, "")
    .replace(/\s+Article\s+[IVXLC]+.*$/i, "")
    .trim();
}

function extractOcacChineseText(raw) {
  const paragraphs = [];
  let buf = [];

  const flush = () => {
    if (!buf.length) return;
    const merged = buf.join("");
    if (/[\u4e00-\u9fff]/.test(merged)) paragraphs.push(merged);
    buf = [];
  };

  for (let line of raw.split(/\n/)) {
    line = stripEnglishTail(line);
    if (!line || isOcacNoiseLine(line) || isEnglishOcacLine(line)) {
      flush();
      continue;
    }
    if (/[\u4e00-\u9fff]/.test(line)) buf.push(line);
    else flush();
  }
  flush();
  return paragraphs.join("\n\n");
}

function parseOcacArticles(paragraphs, max) {
  const out = [];
  const articleRe = /^第([一二三四五六七八九十百]+)条(.*)$/;
  let current = null;

  for (const para of paragraphs) {
    const m = para.match(articleRe);
    if (m) {
      if (current) out.push(formatZhArticle(current.n, current.body));
      current = { n: cnArticleNum(m[1]), body: m[2].trim() };
      continue;
    }
    if (current) {
      current.body = current.body ? `${current.body}\n${para}` : para;
    }
  }
  if (current) out.push(formatZhArticle(current.n, current.body));

  if (out.length !== max) {
    throw new Error(`Expected ${max} OCAC ZH articles, got ${out.length}`);
  }
  return out;
}

function parseZhInerrancyOcac(rawPdfText) {
  const paras = extractOcacChineseText(rawPdfText)
    .split(/\n\n+/)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);

  const out = ["芝加哥圣经无误宣言（1978）"];
  let i = 0;
  while (i < paras.length && paras[i] !== "前言" && !paras[i].startsWith("承认圣经")) i++;
  if (paras[i] === "前言") i++;

  out.push("前言");
  while (i < paras.length && paras[i] !== "宣言概要") {
    out.push(paras[i]);
    i++;
  }
  if (paras[i] !== "宣言概要") throw new Error("OCAC inerrancy: 宣言概要 not found");
  i++;

  out.push("宣言概要");
  while (i < paras.length && !/^第[一二三四五六七八九十百]+条/.test(paras[i]) && paras[i] !== "确认及否认的条文") {
    out.push(paras[i]);
    i++;
  }
  if (paras[i] === "确认及否认的条文") i++;

  out.push("确认与否认条文");
  out.push(...parseOcacArticles(paras.slice(i), 19));
  return out;
}

function parseZhHermeneuticsOcac(rawPdfText) {
  const paras = extractOcacChineseText(rawPdfText)
    .split(/\n\n+/)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);

  const out = ["芝加哥圣经解释宣言（1982）"];
  let i = 0;
  while (i < paras.length && !paras[i].startsWith("国际圣经无误委员会")) i++;

  out.push("序言");
  while (i < paras.length && paras[i] !== "确认及否认的条文" && !/^第[一二三四五六七八九十百]+条/.test(paras[i])) {
    out.push(paras[i]);
    i++;
  }
  if (paras[i] === "确认及否认的条文") i++;

  out.push("确认与否认条文");
  out.push(...parseOcacArticles(paras.slice(i), 25));
  return out;
}

function parseZhInerrancyExpositionFromJidujiaojiaoyu(text) {
  const block = sliceSection(text, "3. 解释说明", "来源：");
  const out = [];
  const parts = block.split(/\n3\.\d+\.\s*/);
  out.push(...splitParagraphs(parts[0].replace(/^3\.\s*解释说明\s*/, "")));
  const headings = [
    "创造、启示和默示",
    "权威：基督与圣经",
    "圣经无谬、圣经无误、圣经解释",
    "怀疑主义与批判主义",
    "抄传与翻译",
    "无误与权威",
  ];
  parts.slice(1).forEach((sec, idx) => {
    const heading = headings[idx];
    if (heading) {
      out.push(heading);
      sec = sec.replace(new RegExp(`^\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), "");
    }
    out.push(...splitParagraphs(sec));
  });
  return out.filter(
    (p) =>
      !/^芝加哥圣经无误宣言英文原版/.test(p) &&
      !/^来源：/.test(p),
  );
}

function formatZhArticle(n, body) {
  const t = normalizeWhitespace(body)
    .replace(/我们确认：/g, "我们确认：")
    .replace(/我们否认：/g, "\n我们否认：")
    .replace(/我们确信：/g, "我们确认：")
    .replace(/我们反对：/g, "\n我们否认：")
    .replace(/我们更确认：/g, "\n我们更确认：")
    .replace(/我们进一步确认：/g, "\n我们进一步确认：")
    .replace(/我们进一步否认：/g, "\n我们进一步否认：")
    .replace(/我们更否认：/g, "\n我们更否认：")
    .replace(/我们也否认：/g, "\n我们也否认：")
    .replace(/我们也反对：/g, "\n我们也否认：");
  return `第 ${n} 条\n${t}`;
}

function writeBodyTs(exportName, fileName, body) {
  const file = path.join(outDir, fileName);
  fs.writeFileSync(
    file,
    `/** Generated by scripts/build-chicago-creed-bodies.mjs — do not edit by hand. */\nimport type { HistoricalCreedBodyContent } from "./types";\n\nexport const ${exportName}: HistoricalCreedBodyContent = ${JSON.stringify(body, null, 2)};\n`,
  );
  return file;
}

function loadHermeneuticsExpositionZh() {
  const file = path.join(sourcesDir, "chicago-hermeneutics-exposition-zh-from-en.json");
  const { paragraphs } = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(paragraphs) || paragraphs.length !== 49) {
    throw new Error(`Expected 49 ZH herm exposition paragraphs, got ${paragraphs?.length}`);
  }
  return paragraphs;
}

function mergeZhHermeneutics(ocacBody, expositionTranslatedParagraphs) {
  /** OCAC 序言+条文 + 无出版资料时从 EN 翻译的「解释说明」 */
  const articlesStart = ocacBody.indexOf("确认与否认条文");
  if (articlesStart < 0) throw new Error("OCAC herm: 确认与否认条文 not found");
  return [
    ...ocacBody.slice(0, articlesStart),
    "解释说明",
    ...expositionTranslatedParagraphs,
    ...ocacBody.slice(articlesStart),
  ];
}

function mergeZhInerrancy(ocacBody, expositionPublishedText) {
  /** OCAC 正文 + 出版译本仅补「解释说明」一节（PDF 无此文） */
  const expositionParas = parseZhInerrancyExpositionFromJidujiaojiaoyu(
    expositionPublishedText.replace(/\t+/g, "\n"),
  );
  return [...ocacBody, "解释说明", ...expositionParas];
}

function main() {
  fs.mkdirSync(sourcesDir, { recursive: true });

  const enHtml = curl(URLS.enCombined);
  const enText = stripHtml(enHtml);
  fs.writeFileSync(path.join(sourcesDir, "chicago-en-defendinginerrancy.txt"), enText);

  const zhInPdf = path.join(sourcesDir, "chicago-inerrancy-zh-ocac.pdf");
  const zhInTxt = path.join(sourcesDir, "chicago-inerrancy-zh-ocac.txt");
  curlBinary(URLS.zhInerrancyPdf, zhInPdf);
  const zhInRaw = extractPdfText(zhInPdf, zhInTxt);
  fs.writeFileSync(zhInTxt, zhInRaw);

  const zhHermPdf = path.join(sourcesDir, "chicago-hermeneutics-zh-ocac.pdf");
  const zhHermTxt = path.join(sourcesDir, "chicago-hermeneutics-zh-ocac.txt");
  curlBinary(URLS.zhHermeneuticsPdf, zhHermPdf);
  const zhHermRaw = extractPdfText(zhHermPdf, zhHermTxt);
  fs.writeFileSync(zhHermTxt, zhHermRaw);

  const zhExpositionHtml = curl(URLS.zhInerrancyExposition);
  const zhExpositionText = parseJidujiaojiaoyu(zhExpositionHtml);
  fs.writeFileSync(
    path.join(sourcesDir, "chicago-inerrancy-exposition-zh-jidujiaojiaoyu.txt"),
    zhExpositionText,
  );

  const { inerrancy: bodyEnIn, hermeneutics: bodyEnHerm } = parseEnCombined(enText);
  const bodyZhIn = cleanZhParagraphs(
    mergeZhInerrancy(parseZhInerrancyOcac(zhInRaw), zhExpositionText),
  );
  const bodyZhHerm = cleanZhParagraphs(
    mergeZhHermeneutics(parseZhHermeneuticsOcac(zhHermRaw), loadHermeneuticsExpositionZh()),
  );

  const inerrancyBody = {
    bodyEn: bodyEnIn,
    bodyZh: bodyZhIn,
    bodyZhTw: bodyZhIn.map(toTraditional),
  };
  const hermeneuticsBody = {
    bodyEn: bodyEnHerm,
    bodyZh: bodyZhHerm,
    bodyZhTw: bodyZhHerm.map(toTraditional),
  };

  const f1 = writeBodyTs("chicagoInerrancyBody", "chicago-inerrancy.ts", inerrancyBody);
  const f2 = writeBodyTs("chicagoHermeneuticsBody", "chicago-hermeneutics.ts", hermeneuticsBody);

  console.log("Wrote", f1);
  console.log(
    "  inerrancy en",
    inerrancyBody.bodyEn.length,
    "zh",
    inerrancyBody.bodyZh.length,
  );
  console.log("    ZH:", JSON.stringify(ZH_SECTION_SOURCES.inerrancy));
  console.log("Wrote", f2);
  console.log(
    "  hermeneutics en",
    hermeneuticsBody.bodyEn.length,
    "zh",
    hermeneuticsBody.bodyZh.length,
  );
  console.log("    ZH:", JSON.stringify(ZH_SECTION_SOURCES.hermeneutics));
}

main();
