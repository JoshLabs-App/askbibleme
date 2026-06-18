/**
 * Rebuilds selected historical creed body files with locale-separated arrays:
 * bodyZh / bodyZhTw = Chinese only, bodyEn = English only (parallel indices).
 */
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  cleanupHistoricalCreedEnglishText,
  normalizeHistoricalCreedChineseText,
} from "../lib/explore/historical-creeds-text-cleanup.mjs";
import {
  formatWcfProofItem,
  linkifyNormalizedChineseRefs,
  parseProofBlockText,
  splitDoctrineAndInlineProofs,
} from "../lib/explore/historical-creeds-scripture-links.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../lib/explore/historical-creeds-bodies");
const sourcesDir = path.join(outDir, "sources");

function readSource(name) {
  return fs.readFileSync(path.join(sourcesDir, name), "utf8");
}

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

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "");
}

function cleanZh(text) {
  return stripSourceAttribution(linkifyNormalizedChineseRefs(normalizeHistoricalCreedChineseText(text)));
}

function stripSourceAttribution(text) {
  return text
    .replace(/\s*©\s*Toronto Emmanuel Church\s*$/i, "")
    .replace(/\s*©\s*[^\n]+$/g, "")
    .trim();
}

function toSimplified(s) {
  const map = {
    條: "条",
    論: "论",
    聖: "圣",
    獨: "独",
    靈: "灵",
    萬: "万",
    國: "国",
    會: "会",
    禮: "礼",
    義: "义",
    護: "护",
    啟: "启",
    書: "书",
    經: "经",
    無: "无",
    謬: "谬",
    體: "体",
    復: "复",
    來: "来",
    們: "们",
    這: "这",
    為: "为",
    與: "与",
    對: "对",
    時: "时",
    後: "后",
    從: "从",
    見: "证",
    證: "证",
    實: "实",
    當: "当",
    將: "将",
    還: "还",
    過: "过",
    達: "达",
    進: "进",
    開: "开",
    關: "关",
    應: "应",
    該: "该",
    說: "说",
    話: "话",
    語: "语",
    讀: "读",
    傳: "传",
    統: "统",
    總: "总",
    眾: "众",
    雖: "虽",
    卻: "却",
    顯: "显",
    親: "亲",
    愛: "爱",
    爾: "尔",
    亞: "亚",
    羅: "罗",
    馬: "马",
    陰: "阴",
    間: "间",
    裡: "里",
    裏: "里",
    內: "内",
    兩: "两",
    個: "个",
    揀: "拣",
    選: "选",
    贖: "赎",
    稱: "称",
    責: "责",
    據: "据",
    擋: "挡",
    禱: "祷",
    離: "离",
    難: "难",
    願: "愿",
    氣: "气",
    質: "质",
    員: "员",
    團: "团",
    滿: "满",
    準: "准",
    確: "确",
    種: "种",
    類: "类",
    處: "处",
    擇: "择",
    陳: "陈",
    訴: "诉",
    貧: "贫",
    窮: "穷",
    貧: "贫",
    禍: "祸",
    禦: "御",
    禦: "御",
    惡: "恶",
    擊: "击",
    擴: "扩",
    產: "产",
    獻: "献",
    禦: "御",
    禦: "御",
    禦: "御",
    禦: "御",
    瓷: "祂",
    扺: "抵",
  };
  return s.replace(/[\u4e00-\u9fff]/g, (ch) => map[ch] || ch);
}

function writeTs(name, exportName, body) {
  const file = path.join(outDir, `${name}.ts`);
  fs.writeFileSync(
    file,
    `import type { HistoricalCreedBodyContent } from "./types";\n\nexport const ${exportName}: HistoricalCreedBodyContent = ${JSON.stringify(body)};\n`,
  );
}

function parseCcelBelgic(text) {
  const start = text.indexOf("第一條");
  if (start < 0) return [];
  const body = text.slice(start);
  const articles = [];
  for (const chunk of body.split(/(?=第[一二三四五六七八九十百]+條\s+)/)) {
    const m = chunk.match(/^第([一二三四五六七八九十百]+)條\s+([^\n]+)\n([\s\S]*)/);
    if (!m) continue;
    articles.push({ title: m[2].trim(), text: cleanZh(m[3]) });
  }
  return articles;
}

function parseCcelWestminster(text) {
  const marker = text.indexOf("第一章  論聖經");
  const alt = text.indexOf("第一章  论圣经");
  const start = marker >= 0 ? marker : alt;
  if (start < 0) return [];
  const body = text.slice(start);
  const blocks = [];
  const chRe = /第([一二三四五六七八九十百]+)章\s+([^\n]+)\n([\s\S]*?)(?=第[一二三四五六七八九十百]+章\s+|$)/g;
  let m;
  while ((m = chRe.exec(body))) {
    blocks.push({ type: "chapter", num: m[1], title: m[2].trim() });
    let chapterContent = m[3];
    let proofText = "";
    const sepIdx = chapterContent.search(/-{5,}/);
    if (sepIdx >= 0) {
      proofText = chapterContent.slice(sepIdx);
      chapterContent = chapterContent.slice(0, sepIdx);
    }
    const parts = chapterContent.split(/(?=[一二三四五六七八九十百]+、)/).filter((p) => p.trim().length > 20);
    for (const p of parts) {
      const { doctrine, inlineProof } = splitDoctrineAndInlineProofs(p);
      if (inlineProof) proofText += inlineProof;
      const t = cleanZh(doctrine);
      if (t.length > 15) blocks.push({ type: "para", text: t });
    }
    const proofItems = parseProofBlockText(proofText);
    if (proofItems.length) blocks.push({ type: "proofs", items: proofItems });
  }
  return blocks;
}

function parseEnBelgic(html) {
  const blocks = [];
  const re = /<h3[^>]*>Article (\d+): <i>([^<]*)<\/i><\/h3>([\s\S]*?)(?=<h3|<h2|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    blocks.push({
      num: m[1],
      title: m[2].trim(),
      text: stripHtml(m[3]).replace(/\s+/g, " ").trim(),
    });
  }
  return blocks;
}

function splitRejectionTailZh(body) {
  const introRe =
    /(?:我們既已解說|關于[\s\S]{2,40}?已經解說了[；;]|此真實的教義已解釋清楚，|真實教義既經解釋，)[\s\S]{0,80}?錯謬[：:]/;
  const match = body.match(introRe);
  if (!match) return { main: body.trim(), intro: "", items: [] };
  const idx = body.indexOf(match[0]);
  const main = body.slice(0, idx).trim();
  const tail = body.slice(idx).trim();
  const intro = tail.slice(0, match[0].length).trim();
  const itemsText = tail.slice(match[0].length).trim();
  const items = [];
  for (const chunk of itemsText.split(/(?=[一二三四五六七八九十]+、)/)) {
    const m = chunk.match(/^([一二三四五六七八九十]+、)([\s\S]+)/);
    if (m) items.push({ label: m[1], text: m[2].trim() });
  }
  return { main, intro, items };
}

function parseEnDortRejections(errHtml) {
  const introM = errHtml.match(/<h4>([\s\S]*?)<\/h4>/i);
  const intro = introM ? stripHtml(introM[1]).replace(/\s+/g, " ").trim() : "";
  const items = [];
  const numRe =
    /<p><strong class="numeral">([IVX]+)\s*<\/strong><\/p>([\s\S]*?)(?=<p><strong class="numeral">|<h3|$)/gi;
  let nm;
  while ((nm = numRe.exec(errHtml))) {
    const paragraphs = [...nm[2].matchAll(/<p>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1]).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    items.push({ label: nm[1].trim(), text: paragraphs.join(" ").trim() });
  }
  return { intro, items };
}

function parseEnDort(html) {
  const blocks = [];
  const sections = [
    { id: "election", errorsId: "election_errors" },
    { id: "redemption", errorsId: "redemption_errors" },
    { id: "corruption", errorsId: "corruption_errors" },
    { id: "perseverance", errorsId: "perseverance_errors" },
  ];
  const artRe = /<h3[^>]*>Article (\d+): <i>([^<]*)<\/i><\/h3>([\s\S]*?)(?=<h3|$)/gi;

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const secStart = html.search(new RegExp(`<h3 id="${sec.id}"`, "i"));
    if (secStart < 0) continue;
    const errorsStart = html.search(new RegExp(`<h3 id="${sec.errorsId}"`, "i"));
    const nextSec = sections[si + 1];
    const secEnd = nextSec
      ? html.search(new RegExp(`<h3 id="${nextSec.id}"`, "i"))
      : html.length;

    const sectionHtml = html.slice(secStart, errorsStart >= 0 ? errorsStart : secEnd);
    const headM = sectionHtml.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    const head = headM ? stripHtml(headM[1]).replace(/\s+/g, " ").trim() : "";

    const artRe =
      /<h3[^>]*>Article (\d+): <i>([^<]*)<\/i><\/h3>([\s\S]*?)(?=<h3|$)/gi;
    for (const am of sectionHtml.matchAll(artRe)) {
      blocks.push({
        type: "article",
        head,
        num: am[1],
        title: am[2].trim(),
        text: stripHtml(am[3]).replace(/\s+/g, " ").trim(),
      });
    }

    if (errorsStart >= 0) {
      const errHtml = html.slice(errorsStart, secEnd >= 0 ? secEnd : html.length);
      const { intro, items } = parseEnDortRejections(errHtml);
      if (intro) blocks.push({ type: "rejection-intro", head, text: intro });
      for (const item of items) {
        blocks.push({ type: "rejection-item", head, label: item.label, text: item.text });
      }
    }
  }
  return blocks;
}

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100 };

function cnToInt(s) {
  if (!s) return 0;
  if (s.length === 1) return CN_NUM[s] || 0;
  if (s.startsWith("十")) return 10 + (CN_NUM[s[1]] || 0);
  if (s.endsWith("十")) return (CN_NUM[s[0]] || 0) * 10;
  if (s.includes("十")) {
    const [a, , b] = s.split("");
    return (CN_NUM[a] || 0) * 10 + (CN_NUM[b] || 0);
  }
  return CN_NUM[s] || 0;
}

function parseDortZh(text) {
  const start = text.indexOf("第一項教義");
  if (start < 0) return [];
  const blocks = [];
  const doctrineParts = text
    .slice(start)
    .split(/(?=^(?:第三與第四項教義|第[一二三四五六七八九十]+項教義)\s)/m);
  for (const dp of doctrineParts) {
    if (!dp.trim()) continue;
    const headM = dp.match(/^(?:第三與第四項教義|第[一二三四五六七八九十]+項教義)\s+([^\n]+)/);
    const head = headM ? headM[0].trim() : "";
    const afterHead = dp.slice(headM ? headM[0].length : 0);
    let sectionRejections = null;

    for (const chunk of afterHead.split(/(?=第[一二三四五六七八九十百]+條\n)/)) {
      const m = chunk.match(/^第([一二三四五六七八九十百]+)條\n([\s\S]+)/);
      if (!m) continue;
      const split = splitRejectionTailZh(m[2]);
      blocks.push({
        type: "article",
        head,
        num: String(cnToInt(m[1])),
        text: cleanZh(split.main),
      });
      if (split.intro) sectionRejections = split;
    }

    if (sectionRejections) {
      blocks.push({ type: "rejection-intro", head, text: cleanZh(sectionRejections.intro) });
      for (const item of sectionRejections.items) {
        blocks.push({
          type: "rejection-item",
          head,
          label: item.label,
          text: cleanZh(item.text),
        });
      }
    }
  }
  return blocks;
}

function parseThirtyNineZh(html) {
  const text = stripHtml(html);
  const start = text.indexOf("第一條");
  if (start < 0) return [];
  const articles = [];
  for (const chunk of text.slice(start).split(/(?=第[一二三四五六七八九十百]+條\s+)/)) {
    const m = chunk.match(/^第([一二三四五六七八九十百]+)條\s+([^\n]+)\n([\s\S]*)/);
    if (!m) continue;
    articles.push({ num: cnToInt(m[1]), title: m[2].trim(), text: cleanZh(m[3]) });
  }
  return articles;
}

function parseEnWcf(html) {
  const blocks = [];
  const parts = html.split(/<h3 class="divider">/);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const titleM = part.match(/<a name="Chapter_(\d+)"><\/a>CHAPTER (\d+)<br \/><i>([^<]+)<\/i>/i);
    if (!titleM) continue;
    blocks.push({ type: "chapter", num: titleM[1], title: titleM[3].trim() });
    const pRe = /<p>([\s\S]*?)<\/p>/gi;
    let pm;
    while ((pm = pRe.exec(part))) {
      let t = pm[1].replace(/<table[\s\S]*?<\/table>/gi, "");
      t = stripHtml(t).replace(/\s+/g, " ").trim();
      if (!t || t.length < 25) continue;
      if (/^Of the (Old|New) Testament/.test(t)) continue;
      blocks.push({ type: "para", text: t });
    }
  }
  return blocks;
}

function splitMixedEntry(zhText, enText) {
  // If zh contains English paragraph after Chinese, strip it
  const enStart = zhText.search(/\n(?:We |The |Article |Chapter |To evangelize|More than |Therefore,|INTRODUCTION)/);
  if (enStart > 0) {
    return { zh: zhText.slice(0, enStart).trim(), en: enText || zhText.slice(enStart).trim() };
  }
  return { zh: zhText.trim(), en: enText?.trim() || "" };
}

function rebuildBelgic(belgicZhArts, belgicEnArts) {
  const bodyZh = [];
  const bodyZhTw = [];
  const bodyEn = [];
  for (let i = 0; i < belgicEnArts.length; i++) {
    const en = belgicEnArts[i];
    const zhArt = belgicZhArts[i];
    bodyEn.push(`Article ${en.num}: ${en.title}\n${en.text}`);
    if (zhArt) {
      bodyZhTw.push(`第 ${en.num} 條：${zhArt.title}\n${zhArt.text}`);
      bodyZh.push(`第 ${en.num} 条：${toSimplified(zhArt.title)}\n${toSimplified(zhArt.text)}`);
    } else {
      bodyZhTw.push(`第 ${en.num} 條：${en.title}`);
      bodyZh.push(`第 ${en.num} 条：${en.title}`);
    }
  }
  return { bodyZh, bodyZhTw, bodyEn };
}

function rebuildWcf(wcfZhBlocks, wcfEnBlocks) {
  const bodyZh = [];
  const bodyZhTw = [];
  const bodyEn = [];
  const enChapters = wcfEnBlocks.filter((b) => b.type === "chapter");
  const enParas = wcfEnBlocks.filter((b) => b.type !== "chapter");
  let enChapterIdx = 0;
  let enParaIdx = 0;

  for (const zh of wcfZhBlocks) {
    if (zh.type === "chapter") {
      const enCh = enChapters[enChapterIdx++];
      const num = cnToInt(zh.num);
      const numLabel = String(num).padStart(2, "0");
      bodyZh.push(`第 ${numLabel} 章 ${toSimplified(zh.title)}`);
      bodyZhTw.push(`第 ${numLabel} 章 ${zh.title}`);
      bodyEn.push(enCh ? `Chapter ${enCh.num}: ${enCh.title}` : `Chapter ${num}: ${zh.title}`);
    } else if (zh.type === "para") {
      const en = enParas[enParaIdx++];
      bodyZhTw.push(zh.text);
      bodyZh.push(toSimplified(zh.text));
      bodyEn.push(en?.text || "");
    } else if (zh.type === "proofs") {
      bodyZh.push("经文依据");
      bodyZhTw.push("經文依據");
      bodyEn.push("Scripture proofs");
      for (const item of zh.items) {
        const linked = formatWcfProofItem(item.num, item.raw);
        bodyZhTw.push(linked);
        bodyZh.push(toSimplified(linked));
        bodyEn.push(`${item.num}.`);
      }
    }
  }
  return { bodyZh, bodyZhTw, bodyEn };
}

function dortZhBlocksToBodies(blocks) {
  const bodyZh = [];
  const bodyZhTw = [];
  let lastHead = "";

  for (const b of blocks) {
    if (b.head && b.head !== lastHead) {
      bodyZhTw.push(b.head);
      bodyZh.push(toSimplified(b.head));
      lastHead = b.head;
    }
    if (b.type === "rejection-intro") {
      bodyZhTw.push(`拒絕謬論\n${b.text}`);
      bodyZh.push(`拒绝谬论\n${toSimplified(b.text)}`);
    } else if (b.type === "rejection-item") {
      bodyZhTw.push(`${b.label}\n${b.text}`);
      bodyZh.push(`${toSimplified(b.label)}\n${toSimplified(b.text)}`);
    } else if (b.type === "article") {
      bodyZhTw.push(`第 ${b.num} 條\n${b.text}`);
      bodyZh.push(`第 ${b.num} 条\n${toSimplified(b.text)}`);
    }
  }
  return { bodyZh, bodyZhTw };
}

function dortEnBlocksToBodies(blocks) {
  const bodyEn = [];
  let lastHead = "";

  for (const b of blocks) {
    if (b.head && b.head !== lastHead) {
      bodyEn.push(b.head);
      lastHead = b.head;
    }
    if (b.type === "rejection-intro") {
      bodyEn.push(`Rejection of Errors\n${b.text}`);
    } else if (b.type === "rejection-item") {
      bodyEn.push(`${b.label}\n${b.text}`);
    } else if (b.type === "article") {
      bodyEn.push(`Article ${b.num}: ${b.title}\n${b.text}`);
    }
  }
  return bodyEn;
}

function rebuildDort(dortEnBlocks, dortZhBlocks) {
  const { bodyZh, bodyZhTw } = dortZhBlocksToBodies(dortZhBlocks);
  const bodyEn = dortEnBlocksToBodies(dortEnBlocks);
  return { bodyZh, bodyZhTw, bodyEn };
}

function countDuplicateSectionHeads(arr) {
  let count = 0;
  for (let i = 1; i < arr.length; i++) {
    const prevFirst = arr[i - 1].split("\n")[0].trim();
    const curFirst = arr[i].split("\n")[0].trim();
    if (prevFirst && curFirst === prevFirst && /教義|教义|Point|Doctrine|章/.test(curFirst)) {
      count++;
    }
  }
  return count;
}

function rebuildFromExistingTs(filename, exportName) {
  const raw = fs.readFileSync(path.join(outDir, filename), "utf8");
  const j = JSON.parse(raw.match(/=\s*(\{[\s\S]+\});/)[1]);
  const len = j.bodyEn.length;
  const bodyZh = [];
  const bodyZhTw = [];
  const bodyEn = [];
  for (let i = 0; i < len; i++) {
    const split = splitMixedEntry(j.bodyZh[i] || "", j.bodyEn[i] || "");
    const splitTw = splitMixedEntry(j.bodyZhTw[i] || "", j.bodyEn[i] || "");
    bodyZh.push(split.zh);
    bodyZhTw.push(splitTw.zh || split.zh);
    bodyEn.push(j.bodyEn[i]);
  }
  writeTs(filename.replace(".ts", ""), exportName, { bodyZh, bodyZhTw, bodyEn });
}

function rebuildBaptist() {
  const titlesZh = [
    "圣经",
    "上帝",
    "人",
    "救恩",
    "恩典之目的",
    "教会",
    "洗礼与圣餐",
    "主日",
    "国度",
    "末世",
    "传福音与宣教",
    "教育",
    "管家职分",
    "合作",
    "基督徒与社会秩序",
    "和平与战争",
    "宗教自由",
    "家庭",
  ];
  const titlesZhTw = [
    "聖經",
    "上帝",
    "人",
    "救恩",
    "恩典之目的",
    "教會",
    "洗禮與聖餐",
    "主日",
    "國度",
    "末世",
    "傳福音與宣教",
    "教育",
    "管家職分",
    "合作",
    "基督徒與社會秩序",
    "和平與戰爭",
    "宗教自由",
    "家庭",
  ];
  const summariesZh = [
    "圣经由圣灵默示写成，是上帝向人启示自己；全然真实可信，是信仰与生活的最高准则，并见证基督。",
    "只有一位活着、真实的上帝；无限圣洁、全能全知；在本质不分，在父、子、圣灵三个位格中启示自己。",
    "人按上帝形象被造，有男有女；因亚当犯罪，全人类继承有罪本性；唯有上帝恩典使人归入圣洁团契。",
    "救恩救赎全人，凡接受基督为主救主者得蒙救赎；无个人信靠基督则无救恩；真信徒必坚忍到底。",
    "拣选是上帝恩典的旨意，与人生自由并行，包含达成救恩的一切手段；真信徒必持守到底。",
    "新约教会是自主的地方信徒团契，守洗礼与圣餐，按基督法则治理；牧者职分限于合资格的男人。",
    "洗礼是信徒奉三一之名浸入水中，象征与基督同死同活；圣餐记念主死，等候主再来。",
    "一周第一日是主日，记念基督复活，当以公私敬拜与灵修守之。",
    "上帝的国包括祂对宇宙的统治，以及人甘心认祂为王所进入的救恩领域；国度完全应验等候主再来。",
    "基督将亲自可见地再来，死人复活，公义审判；不义者入永刑，义者得荣耀，永远与主同在。",
    "每位信徒与教会当努力使万民作门徒；以言语见证、敬虔生活及其他与福音和谐的方法领人归主。",
    "在基督里积蓄一切智慧知识；基督教教育须平衡学术自由与责任，受基督与圣经权威约束。",
    "万物属上帝；信徒当以时间、才干、财物服事上帝，甘心、定期、按比例奉献，推进救赎工作。",
    "信徒可组织协会促进国度事工，彼此无管辖权；各宗派在不妨碍良心、不妥协基督与圣经时可合作。",
    "当使基督旨意居首，反对种族主义、贪婪、淫乱等；关怀弱者，维护自受孕至自然死亡的生命神圣。",
    "基督徒当追求公义和平，尽力止战；世界最需要的，是在万事中接受并实践基督爱的教训。",
    "唯独上帝是良心之主；政教分离，国家保护宗教自由，不得以民事权力推行教会事工或惩罚信仰。",
    "上帝设立家庭为一男一女终身盟约的婚姻；夫妻同等尊贵、各负职责；儿女当孝敬父母，父母当按圣经教养儿女。",
  ];
  const summariesZhTw = [
    "聖經由聖靈默示寫成，是上帝向人啟示自己；全然真實可信，是信仰與生活的最高準則，並見證基督。",
    "只有一位活著、真實的上帝；無限聖潔、全能全知；在本質不分，在父、子、聖靈三個位格中啟示自己。",
    "人按上帝形象被造，有男有女；因亞當犯罪，全人類繼承有罪本性；唯有上帝恩典使人歸入聖潔團契。",
    "救恩救贖全人，凡接受基督為主救主者得蒙救贖；無個人信靠基督則無救恩；真信徒必堅忍到底。",
    "揀選是上帝恩典的旨意，與人生自由並行，包含達成救恩的一切手段；真信徒必持守到底。",
    "新約教會是自主的地方信徒團契，守洗禮與聖餐，按基督法則治理；牧者職分限於合資格的男人。",
    "洗禮是信徒奉三一之名浸入水中，象徵與基督同死同活；聖餐記念主死，等候主再來。",
    "一週第一日是主日，記念基督復活，當以公私敬拜與靈修守之。",
    "上帝的國包括祂對宇宙的統治，以及人甘心認祂為王所進入的救恩領域；國度完全應驗等候主再來。",
    "基督將親自可見地再來，死人復活，公義審判；不義者入永刑，義者得榮耀，永遠與主同在。",
    "每位信徒與教會當努力使萬民作門徒；以言語見證、敬虔生活及其他與福音和諧的方法領人歸主。",
    "在基督裡積蓄一切智慧知識；基督教教育須平衡學術自由與責任，受基督與聖經權威約束。",
    "萬物屬上帝；信徒當以時間、才幹、財物服事上帝，甘心、定期、按比例奉獻，推進救贖工作。",
    "信徒可組織協會促進國度事工，彼此無管轄權；各宗派在不妨礙良心、不妥協基督與聖經時可合作。",
    "當使基督旨意居首，反對種族主義、貪婪、淫亂等；關懷弱者，維護自受孕至自然死亡的生命神聖。",
    "基督徒當追求公義和平，盡力止戰；世界最需要的，是在萬事中接受並實踐基督愛的教訓。",
    "唯獨上帝是良心之主；政教分離，國家保護宗教自由，不得以民事權力推行教會事工或懲罰信仰。",
    "上帝設立家庭為一男一女終身盟約的婚姻；夫妻同等尊貴、各負職責；兒女當孝敬父母，父母當按聖經教養兒女。",
  ];
  const raw = fs.readFileSync(path.join(outDir, "baptist-faith-message.ts"), "utf8");
  const j = JSON.parse(raw.match(/=\s*(\{[\s\S]+\});/)[1]);
  const bodyEn = j.bodyEn;
  const bodyZh = titlesZh.map((t, i) => `第${i + 1}条：${t}\n${summariesZh[i]}`);
  const bodyZhTw = titlesZhTw.map((t, i) => `第${i + 1}條：${t}\n${summariesZhTw[i]}`);
  writeTs("baptist-faith-message", "baptistFaithMessageBody", { bodyZh, bodyZhTw, bodyEn });
}

function rebuildThirtyNine(zhArts, enArts) {
  const bodyZh = [];
  const bodyZhTw = [];
  const bodyEn = [];
  for (let i = 0; i < enArts.length; i++) {
    const en = enArts[i];
    const zh = zhArts[i];
    bodyEn.push(`Article ${en.num}: ${en.title}\n${en.text}`);
    if (zh) {
      bodyZhTw.push(`第${zh.num}條：${zh.title}\n${zh.text}`);
      bodyZh.push(`第${zh.num}条：${toSimplified(zh.title)}\n${toSimplified(zh.text)}`);
    } else {
      bodyZhTw.push(`第${i + 1}條`);
      bodyZh.push(`第${i + 1}条`);
    }
  }
  writeTs("thirty-nine-articles", "thirtyNineArticlesBody", { bodyZh, bodyZhTw, bodyEn });
}

function rebuildLausanne() {
  const sections = [
    { zh: "引言", tw: "引言", enTitle: "INTRODUCTION", zhText: "我们，来自150多个国家的耶稣基督教会成员，在洛桑国际世界传福音大会上聚集，赞美上帝伟大的救恩，为未完成之宣教使命而受挑战，并公开立此信约。", enText: "We, members of the Church of Jesus Christ, from more than 150 nations, participants in the International Congress on World Evangelization at Lausanne, praise God for his great salvation and rejoice in the fellowship he has given us with himself and with each other. We are deeply stirred by what God is doing in our day, moved to penitence by our failures and challenged by the unfinished task of evangelization. We believe the gospel is God's good news for the whole world, and we are determined by his grace to obey Christ's commission to proclaim it to all mankind and to make disciples of every nation. We desire, therefore, to affirm our faith and our resolve, and to make public our covenant." },
    { zh: "一、上帝的目的", tw: "一、上帝的目的", enTitle: "1. THE PURPOSE OF GOD", zhText: "我们确认我们的信仰：独一永恒的上帝是世界的创造主与主——圣父、圣子、圣灵——照祂旨意的目的治理万有。祂从世界中召出一民归自己，又差遣子民回到世界作仆人与见证人，为扩展国度、建造基督身体、荣耀祂的名。我们惭愧承认常否认呼召、失败于使命；但仍愿靠圣灵大能，重新委身传扬福音这宝贵宝藏。", enText: "We affirm our belief in the one eternal God, Creator and Lord of the world, Father, Son and Holy Spirit, who governs all things according to the purpose of his will. He has been calling out from the world a people for himself, and sending his people back into the world to be his servants and his witnesses, for the extension of his kingdom, the building up of Christ's body, and the glory of his name. We confess with shame that we have often denied our calling and failed in our mission, by becoming conformed to the world or by withdrawing from it. Yet we rejoice that, even when borne by earthen vessels, the gospel is still a precious treasure. To the task of making that treasure known in the power of the Holy Spirit we desire to dedicate ourselves anew." },
    { zh: "二、圣经的权威与能力", tw: "二、聖經的權威與能力", enTitle: "2. THE AUTHORITY AND POWER OF THE BIBLE", zhText: "我们确认旧约与新约圣经整本的神圣默示、真实性与权威，是上帝唯一的书面话语，在其所肯定的一切事上毫无错误，是信仰与生活的唯一无误准则。我们也确认上帝话语的大能成就祂救恩的目的；圣灵今日仍借圣经说话。", enText: "We affirm the divine inspiration, truthfulness and authority of both Old and New Testament Scriptures in their entirety as the only written word of God, without error in all that it affirms, and the only infallible rule of faith and practice. We also affirm the power of God's word to accomplish his purpose of salvation. The message of the Bible is addressed to all men and women. For God's revelation in Christ and in Scripture is unchangeable. Through it the Holy Spirit still speaks today." },
    { zh: "三、基督的独特性与普世性", tw: "三、基督的獨特性與普世性", enTitle: "3. THE UNIQUENESS AND UNIVERSALITY OF CHRIST", zhText: "我们确认只有一位救主、只有一条福音。我们否认任何人可借自然启示得救；也拒绝任何暗示基督借一切宗教同样说话的综合主义。耶稣基督是上帝与人之间唯一的中保，别无拯救之名。", enText: "We affirm that there is only one Saviour and only one gospel, although there is a wide diversity of evangelistic approaches. We recognize that everyone has some knowledge of God through his general revelation in nature. But we deny that this can save, for people suppress the truth by their unrighteousness. We also reject as derogatory to Christ and the gospel every kind of syncretism and dialogue which implies that Christ speaks equally through all religions and ideologies. Jesus Christ, being himself the only God-Man, who gave himself as the only ransom for sinners, is the only mediator between God and people. There is no other name by which we must be saved." },
    { zh: "四、传福音的本质", tw: "四、傳福音的本質", enTitle: "4. THE NATURE OF EVANGELISM", zhText: "传福音就是传扬耶稣基督照圣经为我们的罪死、从死里复活，并作为掌权的王，向一切悔改信靠的人赐罪赦与圣灵恩赐的好消息。传福音是宣讲历史上、圣经中的基督为救主与主，并不可隐瞒作门徒的代价。", enText: "To evangelize is to spread the good news that Jesus Christ died for our sins and was raised from the dead according to the Scriptures, and that, as the reigning Lord, he now offers the forgiveness of sins and the liberating gifts of the Spirit to all who repent and believe. Our Christian presence in the world is indispensable to evangelism, and so is that kind of dialogue whose purpose is to listen sensitively in order to understand. But evangelism itself is the proclamation of the historical, biblical Christ as Saviour and Lord, with a view to persuading people to come to him personally and so be reconciled to God. In issuing the gospel invitation we have no liberty to conceal the cost of discipleship." },
    { zh: "五、基督徒的社会责任", tw: "五、基督徒的社會責任", enTitle: "5. CHRISTIAN SOCIAL RESPONSIBILITY", zhText: "我们确认上帝是创造主也是审判者，当关切公义、和解，使万人脱离各样压迫。我们承认曾把传福音与社会关怀彼此割裂；但我们确认：传福音与社会政治参与都是基督徒的责任，二者在基督里不可分裂。", enText: "We affirm that God is both the Creator and the Judge of all men. We therefore should share his concern for justice and reconciliation throughout human society and for the liberation of men and women from every kind of oppression. Because men and women are made in the image of God, every person, regardless of race, religion, colour, culture, class, sex or age, has an intrinsic dignity because of which he or she should be respected and served, not exploited. Here too we express penitence both for our neglect and for having sometimes regarded evangelism and social concern as mutually exclusive. Although reconciliation with other people is not reconciliation with God, nor is social action evangelism, nor is political liberation salvation, nevertheless we affirm that evangelism and socio-political involvement are both part of our Christian duty." },
    { zh: "六、教会与传福音", tw: "六、教會與傳福音", enTitle: "6. THE CHURCH AND EVANGELISM", zhText: "我们确认基督差遣所救赎的子民进入世界，如同父差遣祂一样；普世宣教需要全教会把全福音带到全世界。教会是上帝宇宙旨意中心，是传播福音的器皿。", enText: "We affirm that Christ sends his redeemed people into the world as the Father sent him, and that this calls for a similar deep and costly penetration of the world. We need to break out of our ecclesiastical ghettos and permeate non-Christian society. In the Church's mission of sacrificial service, evangelism is primary. World evangelization requires the whole Church to take the whole gospel to the whole world. The Church is at the very centre of God's cosmic purpose and is his appointed means of spreading the gospel." },
    { zh: "七、传福音中的合作", tw: "七、傳福音中的合作", enTitle: "7. COOPERATION IN EVANGELISM", zhText: "我们确认教会在真理中的可见合一是上帝的目的；传福音也呼召我们合一，因合一坚固见证，分裂则削弱我们和好的福音。", enText: "We affirm that the Church's visible unity in truth is God's purpose. Evangelism also summons us to unity, because our oneness strengthens our witness, just as our disunity undermines our gospel of reconciliation. We recognize, however, that organizational unity may take many forms and does not necessarily advance evangelism. Yet we who share the same biblical faith should be closely united in fellowship, work and witness." },
    { zh: "八、宣教中的教会伙伴", tw: "八、宣教中的教會夥伴", enTitle: "8. CHURCHES IN EVANGENISTIC PARTNERSHIP", zhText: "我们喜乐看见新宣教时代来临；年轻教会正成为普世宣教的重大资源。各教会当思想如何在本地与境外承担宣教责任。", enText: "We rejoice that a new missionary era has dawned. The dominant role of western missions is fast disappearing. God is raising up from the younger churches a great new resource for world evangelization, and is thus demonstrating that the responsibility to evangelize belongs to the whole body of Christ. All churches should therefore be asking God and themselves what they should be doing both to reach their own area and to send missionaries to other parts of the world." },
    { zh: "九、宣教任务的紧迫", tw: "九、宣教任務的緊迫", enTitle: "9. THE URGENCY OF THE EVANGELISTIC TASK", zhText: "仍有超过二十七亿人尚未得闻福音；我们羞愧于这么多人被忽视。我们确信现在是教会与机构应为未得之民竭力祷告、推动宣教的时候；这目标需要牺牲。", enText: "More than 2,700 million people, which is more than two-thirds of all humanity, have yet to be evangelized. We are ashamed that so many have been neglected; it is a standing rebuke to us and to the whole Church. There is now, however, in many parts of the world, an unprecedented receptivity to the Lord Jesus Christ. We are convinced that this is the time for churches and para-church agencies to pray earnestly for the salvation of the unreached and to launch new efforts to achieve world evangelization. The goal should be, by all available means and at the earliest possible time, that every person will have the opportunity to hear, to understand, and to receive the good news. We cannot hope to attain this goal without sacrifice." },
    { zh: "十、传福音与文化", tw: "十、傳福音與文化", enTitle: "10. EVANGELISM AND CULTURE", zhText: "普世宣教策略需要有创意的开拓方法；文化必须受圣经检验与审判。福音不预设任何文化优越，却要转化并丰富文化。", enText: "The development of strategies for world evangelization calls for imaginative pioneering methods. Under God, the result will be the rise of churches deeply rooted in Christ and closely related to their culture. Culture must always be tested and judged by Scripture. Because men and women are God's creatures, some of their culture is rich in beauty and goodness. Because they are fallen, all of it is tainted with sin and some of it is demonic. The gospel does not presuppose the superiority of any culture to another, but evaluates all cultures according to its own criteria of truth and righteousness, and insists on moral absolutes in every culture." },
    { zh: "十一、教育与领袖", tw: "十一、教育與領袖", enTitle: "11. EDUCATION AND LEADERSHIP", zhText: "我们承认有时追求教会增长却忽略深度，也迟迟装备本土领袖。我们仍致力于本土原则，愿各教会有以服事而非辖制为样式的领袖，并改进神学教育。", enText: "We confess that we have sometimes pursued church growth at the expense of church depth, and divorced evangelism from Christian nurture. We also acknowledge that some of our missions have been too slow to equip and encourage national leaders to assume their rightful responsibilities. Yet we are committed to indigenous principles, and long that every church will have national leaders who manifest a Christian style of leadership in terms not of domination but of service. We recognize that there is a great need to improve theological education, especially for church leaders." },
    { zh: "十二、属灵争战", tw: "十二、屬靈爭戰", enTitle: "12. SPIRITUAL CONFLICT", zhText: "我们信与邪恶权势进行属灵争战；须以真理与祷告为武器，并警惕教会内外的假福音与世俗化。", enText: "We believe that we are engaged in constant spiritual warfare with the principalities and powers of evil, who are seeking to overthrow the Church and frustrate its task of world evangelization. We know our need to equip ourselves with God's armour and to fight this battle with the spiritual weapons of truth and prayer. For we detect the activity of our enemy, not only in false ideologies outside the Church, but also inside it in false gospels which twist Scripture and put people in the place of God." },
    { zh: "十三、自由与逼迫", tw: "十三、自由與逼迫", enTitle: "13. FREEDOM AND PERSECUTION", zhText: "我们祷告各国领袖保障思想与信仰自由，并关怀因见证主而受冤屈的人；我们拒绝因逼迫而胆怯。", enText: "It is the God-appointed duty of every government to secure conditions of peace, justice and liberty in which the Church may obey God, serve the Lord Jesus Christ, and preach the gospel without interference. We therefore pray for the leaders of nations and call upon them to guarantee freedom of thought and conscience, and freedom to practise and propagate religion in accordance with the will of God. We also express our deep concern for all who have been unjustly imprisoned, and especially for those who are suffering for their testimony to the Lord Jesus. We promise to pray and work for their freedom. At the same time we refuse to be intimidated by their fate." },
    { zh: "十四、圣灵的大能", tw: "十四、聖靈的大能", enTitle: "14. THE POWER OF THE HOLY SPIRIT", zhText: "我们信圣灵的大能；认罪、信心、重生与成长都是祂的工作。非宣教的教会与自身矛盾，也熄灭圣灵。", enText: "We believe in the power of the Holy Spirit. The Father sent his Spirit to bear witness to his Son; without his witness ours is futile. Conviction of sin, faith in Christ, new birth and Christian growth are all his work. Further, the Holy Spirit is a missionary spirit; thus evangelism should arise spontaneously from a Spirit-filled church. A church that is not a missionary church is contradicting itself and quenching the Spirit." },
    { zh: "十五、基督再来", tw: "十五、基督再來", enTitle: "15. THE RETURN OF CHRIST", zhText: "我们信基督将亲自、可见、大有权柄荣耀地再来，完成救恩与审判；这催促我们传福音直到万邦。", enText: "We believe that Jesus Christ will return personally and visibly, in power and glory, to consummate his salvation and his judgment. This promise of his coming is a further spur to our evangelism, for we remember his words that the gospel must first be preached to all nations. We believe that the interim period between Christ's ascension and return is to be filled with the mission of the people of God, who have no liberty to stop before the end." },
    { zh: "结语", tw: "結語", enTitle: "CONCLUSION", zhText: "因此，我们本着此信仰与决心，与上帝、彼此立约：为普世宣教一同祷告、筹划、同工。愿上帝帮助我们忠于此约！阿们，哈利路亚！", enText: "Therefore, in the light of this our faith and our resolve, we enter into a solemn covenant with God and with each other, to pray, to plan and to work together for the evangelization of the whole world. We call upon others to join us. May God help us by his grace, and for his glory, to be faithful to this our covenant! Amen, Alleluia!" },
  ];
  const bodyZh = ["洛桑信约（1974）", ...sections.map((s) => `${s.zh}\n${s.zhText}`)];
  const bodyZhTw = ["洛桑信約（1974）", ...sections.map((s) => `${s.tw}\n${s.zhText.replace(/我们/g, "我們").replace(/确认/g, "確認").replace(/圣经/g, "聖經").replace(/传/g, "傳").replace(/教会/g, "教會").replace(/关怀/g, "關懷").replace(/圣灵/g, "聖靈").replace(/再来/g, "再來").replace(/祷告/g, "禱告").replace(/筹划/g, "籌劃").replace(/羞愧/g, "羞愧").replace(/确认/g, "確認")}`)];
  const bodyEn = ["Lausanne Covenant (1974)", ...sections.map((s) => `${s.enTitle}\n${s.enText}`)];
  writeTs("lausanne-covenant", "lausanneCovenantBody", { bodyZh, bodyZhTw, bodyEn });
}

async function main() {
  console.log("Loading sources...");
  const belgicZhText = readSource("belgic-zh.txt");
  const wcfZhText = readSource("westminster-zh.txt");
  const dortZhText = readSource("dort-zh.txt");
  const thirtyNineZhHtml = readSource("thirty-nine-articles-zh.txt");

  const [belgicEnHtml, dortEnHtml, wcfEnHtml] = await Promise.all([
    fetch("https://threeforms.org/the-belgic-confession/"),
    fetch("https://threeforms.org/canons-of-dort/"),
    fetch("https://www.opc.org/wcf.html"),
  ]);

  const belgicZhArts = parseCcelBelgic(belgicZhText);
  const wcfZhBlocks = parseCcelWestminster(stripHtml(wcfZhText));
  const belgicEnArts = parseEnBelgic(belgicEnHtml);
  const dortEnBlocks = parseEnDort(dortEnHtml);
  const dortZhBlocks = parseDortZh(dortZhText);
  const wcfEnBlocks = parseEnWcf(wcfEnHtml);
  const thirtyNineZhArts = parseThirtyNineZh(thirtyNineZhHtml);
  const thirtyNineEnArts = parseEnBelgic(
    (await fetch("https://threeforms.org/the-thirty-nine-articles/")).replace(
      /Article (\d+):/g,
      "Article $1:",
    ),
  );

  console.log("Parsed counts:", {
    belgicZh: belgicZhArts.length,
    belgicEn: belgicEnArts.length,
    wcfZh: wcfZhBlocks.length,
    wcfEn: wcfEnBlocks.length,
    dortZh: dortZhBlocks.length,
    dortEn: dortEnBlocks.length,
    thirtyNineZh: thirtyNineZhArts.length,
    thirtyNineEn: thirtyNineEnArts.length,
  });

  writeTs("belgic-confession", "belgicConfessionBody", rebuildBelgic(belgicZhArts, belgicEnArts));
  writeTs("westminster-confession", "westminsterConfessionBody", rebuildWcf(wcfZhBlocks, wcfEnBlocks));
  writeTs("canons-of-dort", "canonsOfDortBody", rebuildDort(dortEnBlocks, dortZhBlocks));

  if (thirtyNineEnArts.length === 39) {
    rebuildThirtyNine(thirtyNineZhArts, thirtyNineEnArts);
  } else {
    const existing = JSON.parse(
      fs.readFileSync(path.join(outDir, "thirty-nine-articles.ts"), "utf8").match(/=\s*(\{[\s\S]+\});/)[1],
    );
    const enArts = existing.bodyEn.map((block, i) => {
      const lines = block.split("\n");
      const first = lines[0] || "";
      const title = first.replace(/^Article \d+:\s*/, "").trim();
      const bodyLines = lines.slice(1).filter((l) => l.trim() && l.trim() !== title);
      return { num: String(i + 1), title, text: bodyLines.join("\n").trim() };
    });
    rebuildThirtyNine(thirtyNineZhArts, enArts);
  }

  rebuildBaptist();
  rebuildLausanne();

  // Validate locale separation and segmentation
  for (const name of ["belgic-confession", "westminster-confession", "canons-of-dort", "thirty-nine-articles", "baptist-faith-message", "lausanne-covenant"]) {
    const j = JSON.parse(fs.readFileSync(path.join(outDir, `${name}.ts`), "utf8").match(/=\s*(\{[\s\S]+\});/)[1]);
    const lenOk = j.bodyZh.length === j.bodyEn.length && j.bodyZhTw.length === j.bodyEn.length;
    const enInZh = j.bodyZh.filter((s) => /\b(We |The |Article |Chapter |God |Christ )/.test(s)).length;
    const dupHeads = countDuplicateSectionHeads(j.bodyZh);
    console.log(`${name}: parallel=${lenOk} zhLen=${j.bodyZh.length} enInZh=${enInZh} dupSectionHeads=${dupHeads}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
