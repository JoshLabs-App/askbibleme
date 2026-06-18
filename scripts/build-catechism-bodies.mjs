/**
 * Builds full-text catechism body chunks (lazy-loaded in the app).
 * Sources: CCEL big5 (zh), CRCNA (Heidelberg en), OPC (WSC/WLC en), archive.org godwithus (WLC zh).
 */
import https from "https";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import {
  cleanupHistoricalCreedEnglishText,
  normalizeHistoricalCreedChineseText,
} from "../lib/explore/historical-creeds-text-cleanup.mjs";
import { linkifyNormalizedChineseRefs } from "../lib/explore/historical-creeds-scripture-links.mjs";
import {
  assertOutlineCoversQuestions,
  WSC_OUTLINE,
  WLC_OUTLINE,
} from "../lib/explore/westminster-catechism-outline.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../lib/explore/historical-creeds-bodies");

const WSC_TOTAL = 107;
const WSC_PART2_START = 39;
const WLC_TOTAL = 196;
const WLC_PART2_START = 91;
const HEIDELBERG_TOTAL = 129;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetch(res.headers.location).then(resolve, reject);
          return;
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function fetchCurl(url) {
  return execSync(`curl -sL "${url}"`, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
}

function fetchBig5(url) {
  return execSync(`curl -sL "${url}" | iconv -f big5 -t utf-8`, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "");
}

function toHalfwidthDigits(s) {
  return s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));
}

function toSimplified(s) {
  const map = {
    條: "条", 論: "论", 聖: "圣", 獨: "独", 靈: "灵", 萬: "万", 國: "国", 會: "会",
    禮: "礼", 義: "义", 護: "护", 啟: "启", 書: "书", 經: "经", 無: "无", 體: "体",
    復: "复", 來: "来", 們: "们", 這: "这", 為: "为", 與: "与", 對: "对", 時: "时",
    後: "后", 從: "从", 證: "证", 實: "实", 當: "当", 將: "将", 還: "还", 過: "过",
    達: "达", 進: "进", 開: "开", 關: "关", 應: "应", 該: "该", 說: "说", 話: "话",
    語: "语", 讀: "读", 傳: "传", 統: "统", 總: "总", 眾: "众", 雖: "虽", 卻: "却",
    顯: "显", 親: "亲", 愛: "爱", 爾: "尔", 亞: "亚", 羅: "罗", 馬: "马", 陰: "阴",
    間: "间", 裡: "里", 裏: "里", 內: "内", 兩: "两", 個: "个", 揀: "拣", 選: "选",
    贖: "赎", 稱: "称", 責: "责", 據: "据", 禱: "祷", 離: "离", 難: "难", 願: "愿",
    氣: "气", 質: "质", 員: "员", 團: "团", 滿: "满", 準: "准", 確: "确", 種: "种",
    類: "类", 處: "处", 擇: "择", 訴: "诉", 貧: "贫", 窮: "穷", 禍: "祸", 惡: "恶",
    擊: "击", 擴: "扩", 產: "产", 獻: "献", 瓷: "祂", 問: "问", 答: "答",
    韋: "韦", 爾: "尔", 爾: "尔",
  };
  return s.replace(/[\u4e00-\u9fff]/g, (ch) => map[ch] || ch);
}

function cleanZh(text) {
  return linkifyNormalizedChineseRefs(
    normalizeHistoricalCreedChineseText(
      toHalfwidthDigits(text)
        .replace(/<A[^>]*>/gi, "")
        .replace(/<\/A>/gi, "")
        .replace(/\s*©[^\n]+/g, "")
        .trim(),
    ),
  );
}

function cleanEn(text) {
  return cleanupHistoricalCreedEnglishText(
    text
      .replace(/<sup>[^<]*<\/sup>/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function qaParagraph(n, question, answer, locale = "zh") {
  if (locale === "en") {
    return `Q. ${n}. ${question}\nA. ${answer}`;
  }
  return `问${n}：${question}\n答：${answer}`;
}

function trimProofTail(text) {
  let t = text.trim();
  const cutPoints = [
    t.search(/\s*略解[：:]/),
    t.search(/\n\s*-{3,}/),
    t.search(/\s+1\.\s*(?:林|诗|弗|罗|太|创|出|申|赛|耶|約|詩|弗|羅|太|創|出|申|賽)/),
  ].filter((i) => i >= 0);
  if (cutPoints.length) t = t.slice(0, Math.min(...cutPoints));
  return t.replace(/\s+/g, " ").trim();
}

function stripOpcFooter(text) {
  const marker = "The Orthodox Presbyterian Church";
  const last = text.lastIndexOf(marker);
  if (last < 0) return text.trim();
  const beforeFooter = text.slice(0, last);
  if (beforeFooter.includes("Q. 1.") || beforeFooter.includes("Q. 1 ")) {
    return beforeFooter.trim();
  }
  return text.trim();
}

function trimOpcAnswerTail(text) {
  return text
    .split(
      /\s+The Orthodox Presbyterian Church\b|\bCONTACT US\b|Privacy Policy|&copy; 20\d{2}|© 20\d{2}/,
    )[0]
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse 问N：/问N；/问N? … 答… into a question-number map (keeps longest answer). */
function parseZhQaMap(text) {
  const map = new Map();
  const normalized = toHalfwidthDigits(text).replace(/問/g, "问");
  const chunks = normalized.split(/(?=(?:问)\s*[0-9]+[；:：?？])/);
  for (const chunk of chunks) {
    const m = chunk.match(
      /^问\s*(\d+)[；:：?？]\s*([\s\S]*?)(?:\n\s*答[：:;；]?\s*([\s\S]*))?$/,
    );
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const q = trimProofTail(m[2].replace(/\n+/g, " "));
    let a = trimProofTail((m[3] || "").replace(/\n+/g, " "));
    a = a.split(/证明经文|證明經文|Proof Texts|OPC版|CCEL版|CRTA版|吕沛渊版|王志勇版/)[0].trim();
    if (!q || !a || a.length < 8) continue;
    const prev = map.get(n);
    if (!prev || a.length > prev.answer.length) {
      map.set(n, { question: q, answer: a });
    }
  }
  return map;
}

function parseOpcEnMap(html) {
  const map = new Map();
  const plain = stripOpcFooter(stripHtml(html));
  const re = /Q\.\s*(\d+)\.\s*([\s\S]*?)\n\s*A\.\s*([\s\S]*?)(?=\n\s*Q\.\s*\d+\.|$)/g;
  let m;
  while ((m = re.exec(plain))) {
    const n = parseInt(m[1], 10);
    const q = cleanEn(m[2].replace(/\n+/g, " "));
    let a = cleanEn(trimOpcAnswerTail(m[3].replace(/\n+/g, " ")));
    a = a.split(/WHAT MAN OUGHT TO BELIEVE|HAVING SEEN WHAT THE SCRIPTURES/)[0].trim();
    if (q && a) map.set(n, { question: q, answer: a });
  }
  return map;
}

function parseCrcnaHeidelbergEn(html) {
  const qaMap = new Map();
  const lordDays = [];
  const dayParts = html.split(/<h4>Lord[\u2019']s Day (\d+)<\/h4>/gi);
  for (let i = 1; i < dayParts.length; i += 2) {
    const day = parseInt(dayParts[i], 10);
    const section = dayParts[i + 1] || "";
    const qs = [...section.matchAll(/Q &amp; A (\d+)/g)].map((x) => parseInt(x[1], 10));
    if (qs.length) lordDays.push({ day, questions: qs });
  }

  const qaParts = html.split(/Q &amp; A (\d+)/);
  for (let i = 1; i < qaParts.length; i += 2) {
    const n = parseInt(qaParts[i], 10);
    const block = qaParts[i + 1] || "";
    const end = block.search(/Q &amp; A \d+|<h[34]/);
    const content = end >= 0 ? block.slice(0, end) : block;
    const paragraphs = [...content.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) =>
      x[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    const qLines = [];
    const aLines = [];
    let inAnswer = false;
    for (const p of paragraphs) {
      if (/^\d+\s/.test(p) && /biblegateway|passage/i.test(content)) break;
      if (/^Q\./.test(p)) {
        inAnswer = false;
        qLines.push(p.replace(/^Q\.\s*/, ""));
        continue;
      }
      if (/^A\./.test(p)) {
        inAnswer = true;
        aLines.push(p.replace(/^A\.\s*/, ""));
        continue;
      }
      if (inAnswer) aLines.push(p);
      else if (qLines.length) qLines[qLines.length - 1] += " " + p;
    }
    const question = cleanEn(qLines.join(" "));
    const answer = cleanEn(aLines.join(" "));
    if (question && answer) qaMap.set(n, { question, answer });
  }

  return { qaMap, lordDays };
}

function assertQuestionMap(name, map, total) {
  const missing = [];
  for (let n = 1; n <= total; n++) {
    if (!map.has(n)) missing.push(n);
  }
  if (missing.length) {
    throw new Error(`${name}: missing questions ${missing.join(", ")} (got ${map.size}/${total})`);
  }
}

function assertSameLength(name, ...arrays) {
  const len = arrays[0].length;
  for (const arr of arrays.slice(1)) {
    if (arr.length !== len) {
      throw new Error(`${name}: paragraph count mismatch (${len} vs ${arr.length})`);
    }
  }
}

function westminsterPartHeaders(locale) {
  return {
    1:
      locale === "en"
        ? "PART I: What man is to believe concerning God"
        : locale === "zh-TW"
          ? "第一部分：我們該信什麼"
          : "第一部分：我们该信什么",
    2:
      locale === "en"
        ? "PART II: What duty God requires of man"
        : locale === "zh-TW"
          ? "第二部分：我們該作什麼"
          : "第二部分：我们该作什么",
  };
}

function westminsterLargerPartHeaders(locale) {
  return {
    1:
      locale === "en"
        ? "PART I: OF WHAT MAN IS TO BELIEVE CONCERNING GOD"
        : locale === "zh-TW"
          ? "第一部分：我們當信什麼"
          : "第一部分：我们当信什么",
    2:
      locale === "en"
        ? "PART II: WHAT DUTY GOD REQUIRES OF MAN"
        : locale === "zh-TW"
          ? "第二部分：我們當怎樣行"
          : "第二部分：我们当怎样行",
  };
}

function topicTitle(section, locale) {
  if (locale === "en") return section.titleEn;
  if (locale === "zh-TW") return section.titleZhTw;
  return section.titleZh;
}

function buildWestminsterBody(qaMap, locale, outline, partHeaders, total) {
  assertOutlineCoversQuestions(outline, total);
  const paragraphs = [];
  let currentPart = 0;
  for (const section of outline) {
    if (section.part !== currentPart) {
      paragraphs.push(partHeaders[section.part]);
      currentPart = section.part;
    }
    paragraphs.push(topicTitle(section, locale));
    for (let n = section.startQ; n <= section.endQ; n++) {
      const qa = qaMap.get(n);
      paragraphs.push(qaParagraph(n, qa.question, qa.answer, locale === "en" ? "en" : "zh"));
    }
  }
  return paragraphs;
}

function buildWscBody(qaMap, locale) {
  return buildWestminsterBody(qaMap, locale, WSC_OUTLINE, westminsterPartHeaders(locale), WSC_TOTAL);
}

function buildWlcBody(qaMap, locale) {
  return buildWestminsterBody(
    qaMap,
    locale,
    WLC_OUTLINE,
    westminsterLargerPartHeaders(locale),
    WLC_TOTAL,
  );
}

function buildHeidelbergBody(qaMap, lordDays, locale) {
  const paragraphs = [];
  for (const { day, questions } of lordDays) {
    paragraphs.push(locale === "en" ? `Lord's Day ${day}` : `主日 ${day}`);
    for (const n of questions) {
      const qa = qaMap.get(n);
      paragraphs.push(qaParagraph(n, qa.question, qa.answer, locale === "en" ? "en" : "zh"));
    }
  }
  return paragraphs;
}

function parseWscZh(raw) {
  const start = raw.search(/韋斯敏斯德小要理問答|威斯敏斯特小要理问答|韦斯敏斯特小要理问答/);
  return parseZhQaMap(start >= 0 ? raw.slice(start) : raw);
}

function parseHeidelbergZh(raw) {
  const start = raw.search(/海德堡要理問答|海德堡要理问答/);
  return parseZhQaMap(start >= 0 ? raw.slice(start) : raw);
}

function parseLigonierWlcZh(html) {
  const map = new Map();
  const blocks = html.split(/<strong>問<\/strong>\s*(\d+)\s*[：:]/);
  for (let i = 1; i < blocks.length; i += 2) {
    const n = parseInt(blocks[i], 10);
    if (n < 1 || n > WLC_TOTAL) continue;
    const section = blocks[i + 1] || "";
    const qEnd = section.indexOf("<strong>答</strong>");
    if (qEnd < 0) continue;
    const question = stripHtml(section.slice(0, qEnd)).replace(/\s+/g, " ").trim();
    let answerBlock = section.slice(qEnd);
    const nextQ = answerBlock.search(/<strong>問<\/strong>\s*\d+\s*[：:]/);
    if (nextQ >= 0) answerBlock = answerBlock.slice(0, nextQ);
    let answer = stripHtml(answerBlock.replace(/^[^：:]*[：:]/, "")).replace(/\s+/g, " ").trim();
    answer = trimProofTail(answer);
    if (!question || !answer || answer.length < 12) continue;
    const prev = map.get(n);
    if (!prev || answer.length > prev.answer.length) {
      map.set(n, { question, answer });
    }
  }
  return map;
}

async function fetchWlcZhMaps() {
  const sources = [
    async () => {
      const json = fetchCurl(
        "https://zh.ligonier.org/wp-json/wp/v2/pages?slug=westminster-larger-catechism",
      );
      if (!json.trim().startsWith("[")) return null;
      const page = JSON.parse(json)?.[0]?.content?.rendered;
      if (!page) return null;
      return parseLigonierWlcZh(page);
    },
    async () => {
      const pages = await Promise.all([
        fetch("https://web.archive.org/web/2020/https://www.godwithus.cn/WLC1-50"),
        fetch("https://web.archive.org/web/2020/https://www.godwithus.cn/WLC51-100"),
        fetch("https://web.archive.org/web/2020/https://www.godwithus.cn/WLC101-150"),
        fetch("https://web.archive.org/web/2020/https://www.godwithus.cn/WLC151-196"),
      ]);
      if (pages.some((p) => !p || p.length < 1000)) return null;
      return parseWlcZhMap(pages);
    },
  ];

  for (const load of sources) {
    try {
      const map = await load();
      if (!map) continue;
      const missing = [];
      for (let n = 1; n <= WLC_TOTAL; n++) {
        if (!map.has(n)) missing.push(n);
      }
      if (!missing.length) return map;
      console.warn(`WLC zh source incomplete (missing ${missing.length}), trying next…`);
    } catch (e) {
      console.warn("WLC zh source failed:", e.message);
    }
  }
  throw new Error("WLC zh: no complete source available");
}

function parseWlcZhMap(htmlPages) {
  const map = new Map();
  const re =
    /(?:^|\n)\s*(\d{1,3})问[；:：]\s*([^\n]+)\n+\s*答[：:]?\s*([\s\S]*?)(?=(?:\n\s*\d{1,3}问[；:：])|\n\s*(?:王志勇版|吕沛渊版|OPC版|CCEL版|CRTA版|证明经文)|$)/g;

  for (const html of htmlPages) {
    const plain = stripHtml(html).replace(/問/g, "问");
    let m;
    while ((m = re.exec(plain))) {
      const n = parseInt(m[1], 10);
      if (n < 1 || n > WLC_TOTAL) continue;
      const q = trimProofTail(m[2].replace(/\s+/g, " ").trim());
      let a = trimProofTail(m[3]);
      a = a.split(/证明经文|證明經文|Proof Texts|OPC版|CCEL版|CRTA版|吕沛渊版|王志勇版/)[0].trim();
      if (!q || !a || a.length < 12) continue;
      const prev = map.get(n);
      if (!prev || a.length > prev.answer.length) {
        map.set(n, { question: q, answer: a });
      }
    }
  }
  return map;
}

function writeTs(name, exportName, body) {
  const file = path.join(outDir, `${name}.ts`);
  fs.writeFileSync(
    file,
    `import type { HistoricalCreedBodyContent } from "./types";\n\nexport const ${exportName}: HistoricalCreedBodyContent = ${JSON.stringify(body)};\n`,
  );
}

async function main() {
  console.log("Fetching sources…");
  const [wscZhRaw, heidelbergZhRaw, wscEnHtml, wlcEnHtml, heidelbergEnHtml] = await Promise.all([
    Promise.resolve(fetchBig5("https://www.ccel.org/contrib/cn/creeds/westcatech.html")),
    Promise.resolve(fetchBig5("https://www.ccel.org/contrib/cn/creeds/heidelberg.html")),
    fetch("https://www.opc.org/sc.html"),
    fetch("https://www.opc.org/lc.html"),
    fetch("https://www.crcna.org/welcome/beliefs/confessions/heidelberg-catechism"),
  ]);

  const wlcZhMap = await fetchWlcZhMaps();
  const wscZhMap = parseWscZh(wscZhRaw);
  const wscEnMap = parseOpcEnMap(wscEnHtml);
  assertQuestionMap("WSC zh", wscZhMap, WSC_TOTAL);
  assertQuestionMap("WSC en", wscEnMap, WSC_TOTAL);

  const wscZhTw = buildWscBody(wscZhMap, "zh-TW").map((p) =>
    /^问\d/.test(p) || /^Q\./.test(p) ? cleanZh(p) : p,
  );
  const wscZh = wscZhTw.map(toSimplified);
  const wscEn = buildWscBody(wscEnMap, "en");
  assertSameLength("WSC", wscZh, wscZhTw, wscEn);

  const { qaMap: heidelbergEnMap, lordDays } = parseCrcnaHeidelbergEn(heidelbergEnHtml);
  const heidelbergZhMap = parseHeidelbergZh(heidelbergZhRaw);
  assertQuestionMap("Heidelberg en", heidelbergEnMap, HEIDELBERG_TOTAL);
  assertQuestionMap("Heidelberg zh", heidelbergZhMap, HEIDELBERG_TOTAL);
  if (lordDays.length !== 52) {
    throw new Error(`Heidelberg: expected 52 Lord's Days, got ${lordDays.length}`);
  }

  const heidelbergZhTw = buildHeidelbergBody(heidelbergZhMap, lordDays, "zh-TW").map((p) =>
    /^问\d/.test(p) ? cleanZh(p) : p,
  );
  const heidelbergZh = heidelbergZhTw.map(toSimplified);
  const heidelbergEn = buildHeidelbergBody(heidelbergEnMap, lordDays, "en");
  assertSameLength("Heidelberg", heidelbergZh, heidelbergZhTw, heidelbergEn);

  const wlcEnMap = parseOpcEnMap(wlcEnHtml);
  assertQuestionMap("WLC zh", wlcZhMap, WLC_TOTAL);
  assertQuestionMap("WLC en", wlcEnMap, WLC_TOTAL);

  const wlcZhTw = buildWlcBody(wlcZhMap, "zh-TW").map((p) =>
    /^问\d/.test(p) ? cleanZh(p) : p,
  );
  const wlcZh = wlcZhTw.map(toSimplified);
  const wlcEn = buildWlcBody(wlcEnMap, "en");
  assertSameLength("WLC", wlcZh, wlcZhTw, wlcEn);

  console.log("Counts:", {
    wscZh: wscZh.length,
    wscEn: wscEn.length,
    heidelbergZh: heidelbergZh.length,
    heidelbergEn: heidelbergEn.length,
    wlcZh: wlcZh.length,
    wlcEn: wlcEn.length,
  });

  writeTs("westminster-shorter-catechism", "westminsterShorterCatechismBody", {
    bodyZh: wscZh,
    bodyZhTw: wscZhTw,
    bodyEn: wscEn,
  });
  writeTs("heidelberg-catechism", "heidelbergCatechismBody", {
    bodyZh: heidelbergZh,
    bodyZhTw: heidelbergZhTw,
    bodyEn: heidelbergEn,
  });
  writeTs("westminster-larger-catechism", "westminsterLargerCatechismBody", {
    bodyZh: wlcZh,
    bodyZhTw: wlcZhTw,
    bodyEn: wlcEn,
  });

  console.log("Done — all locales aligned.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
