/**
 * Syncs ecumenical creed bodies from published sources (no paraphrase).
 * EN: threeforms.org (URCNA)
 * ZH: ccctspm.com (中国基督教网)
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../lib/explore/historical-creeds-bodies");
const sourcesDir = path.join(outDir, "sources");

const CHALCEDON_EN = `Following, then, the holy Fathers, we all unanimously teach that we should confess one and the same Son, our Lord Jesus Christ: the same perfect in Godhead and also perfect in manhood; truly God and truly man, of a reasonable soul and body; consubstantial with the Father according to the Godhead, and consubstantial with us according to the Manhood; in all things like unto us, without sin; begotten before all ages of the Father according to the Godhead, and in these latter days, for us and for our salvation, born of the Virgin Mary, the Mother of God, according to the Manhood; one and the same Christ, Son, Lord, only-begotten, to be acknowledged in two natures, inconfusedly, unchangeably, indivisibly, inseparably; the distinction of natures being by no means taken away by the union, but rather the property of each nature being preserved, and concurring in one Person and one Subsistence, not parted or divided into two persons, but one and the same Son, and only begotten, God the Word, the Lord Jesus Christ; as the prophets from the beginning have declared concerning Him, and the Lord Himself has taught us, and the Creed of the holy Fathers has handed down to us.`;

function curl(url) {
  return execSync(`curl -sL "${url}"`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
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
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "");
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
    擊: "击", 擴: "扩", 產: "产", 獻: "献", 問: "问", 答: "答", 遲: "迟", 進: "进",
    馬: "马", 瑪: "玛", 利: "利", 亞: "亚",
  };
  return s.replace(/[\u4e00-\u9fff]/g, (ch) => map[ch] || ch);
}

function stripThreeformsIntro(text) {
  return text
    .replace(/Aa\s*\+\s*[-–—−]\s*Introduction\s*/gi, "")
    .replace(/\s+\d+\s+See\s+Heidelberg[\s\S]*$/i, "")
    .replace(/\s+\d+\s+["“]Catholic["”][\s\S]*$/i, "")
    .replace(/\s+The Apostles' Creed\s*$/i, "")
    .replace(/\s+The Nicene Creed\s*$/i, "")
    .replace(/\s+The Athanasian Creed\s*$/i, "")
    .trim();
}

function stripEnInlineFootnotes(text) {
  return text
    .replace(/([a-z;])(\d+)(?=\s|[.;,]|$)/gi, "$1")
    .replace(/([a-z]{4,})(\d{1,2})(?=\s|[.;,]|$)/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseThreeforms(slug) {
  const html = curl(`https://threeforms.org/${slug}/`);
  const m = html.match(/<div class="entry-content[^"]*">([\s\S]*?)<\/div>\s*<footer/);
  if (!m) throw new Error(`threeforms entry-content not found: ${slug}`);
  let text = stripHtml(m[1]);
  text = stripThreeformsIntro(text);
  text = text.replace(/\[\d+\]\s*/g, (match, offset, whole) => {
    return offset === 0 || /\[\d+\]\s*$/.test(whole.slice(0, offset)) ? match : `\n${match}`;
  });
  text = text.replace(/(\[\d+\])/g, "\n$1 ").trim();
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function splitAthanasianEn(raw) {
  const items = [];
  const re = /\[(\d+)\]\s*([^[]+)/g;
  let m;
  while ((m = re.exec(raw))) {
    items.push(
      m[2]
        .trim()
        .replace(/\s+\d+$/, "")
        .replace(/([a-z]{4,})(\d{1,2})(?=\s|[.;,]|$)/gi, "$1")
        .replace(/\s+/g, " "),
    );
  }
  if (items.length < 40) throw new Error(`Athanasian EN: expected ~44 items, got ${items.length}`);
  return items;
}

function splitApostlesEn(raw) {
  const t = stripEnInlineFootnotes(stripThreeformsIntro(raw));
  const parts = t.split(/(?=I believe in)/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return [t];
  return parts;
}

function splitNiceneEn(raw) {
  const t = stripEnInlineFootnotes(stripThreeformsIntro(raw));
  const god = t.match(/^(I believe in one God[^]*?)(?=And in one Lord)/i)?.[1]?.trim();
  const lord = t.match(/(And in one Lord[^]*?)(?=I believe in the Holy Spirit)/i)?.[1]?.trim();
  const spirit = t.match(/(I believe in the Holy Spirit[^]*)/i)?.[1]?.trim();
  if (god && lord && spirit) return [god, lord.replace(/\s+And\s*$/, ""), spirit];
  const parts = t
    .split(/(?=And in one Lord|I believe in one God|I believe in the Holy Spirit)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length >= 3 ? parts : [t];
}

function parseCcctspm(id) {
  const html = curl(`http://www.ccctspm.com/faithinfo/${id}`);
  const text = stripHtml(html);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const stopWords = ["相关阅读", "阅读排行", "灵修伴侣", "在线下载", "APP下载", "Copyright"];
  const startMarkers = ["我信", "我等信", "我们跟随", "1.", "任何人欲得救"];
  let start = lines.findIndex((l) => startMarkers.some((m) => l.startsWith(m) || l.includes(m)));
  if (start < 0) start = 0;
  const body = [];
  for (let i = start; i < lines.length; i++) {
    if (stopWords.some((w) => lines[i].includes(w))) break;
    if (/^20\d\d-\d\d-\d\d$/.test(lines[i])) continue;
    if (lines[i] === "A+" || lines[i] === "A-") continue;
    body.push(lines[i]);
  }
  return body.join("\n").trim();
}

function splitAthanasianZh(raw) {
  const byNum = Array.from({ length: 44 }, () => null);
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const seg of trimmed.split(/(?<![0-9])(?=\d+\.\s)/)) {
      const m = seg.match(/^(\d+)\.\s*(.+)$/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 44) byNum[n - 1] = m[2].trim();
    }
  }
  const items = byNum.filter(Boolean);
  if (items.length < 40) throw new Error(`Athanasian ZH: expected ~44 items, got ${items.length}`);
  return items;
}

function splitApostlesZh(raw) {
  const one = raw.replace(/\s+/g, " ").trim();
  const parts = [
    one.match(/我信上帝[^我]*/)?.[0]?.trim(),
    one.match(/我信我主[^我]*/)?.[0]?.trim(),
    one.match(/我信圣灵[\s\S]*/)?.[0]?.trim(),
  ].filter(Boolean);
  return parts.length === 3 ? parts : [one];
}

function splitNiceneZh(raw) {
  return raw
    .split(/(?=我等信独一之主|我等信圣灵)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitChalcedonZh(raw) {
  return raw
    .split(/(?<=；)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);
}

function splitChalcedonEn(text) {
  const clauses = [
    "Following, then, the holy Fathers, we all unanimously teach that we should confess one and the same Son, our Lord Jesus Christ: the same perfect in Godhead and also perfect in manhood;",
    "truly God and truly man, of a reasonable soul and body;",
    "consubstantial with the Father according to the Godhead, and consubstantial with us according to the Manhood; in all things like unto us, without sin;",
    "begotten before all ages of the Father according to the Godhead, and in these latter days, for us and for our salvation, born of the Virgin Mary, the Mother of God, according to the Manhood;",
    "one and the same Christ, Son, Lord, only-begotten, to be acknowledged in two natures, inconfusedly, unchangeably, indivisibly, inseparably;",
    "the distinction of natures being by no means taken away by the union, but rather the property of each nature being preserved, and concurring in one Person and one Subsistence, not parted or divided into two persons, but one and the same Son, and only begotten, God the Word, the Lord Jesus Christ;",
    "as the prophets from the beginning have declared concerning Him, and the Lord Himself has taught us, and the Creed of the holy Fathers has handed down to us.",
  ];
  return clauses;
}

function writeTs(exportName, body) {
  const file = path.join(outDir, "ecumenical-creeds.generated.ts");
  return { exportName, body, file };
}

function main() {
  fs.mkdirSync(sourcesDir, { recursive: true });

  const apostlesEnRaw = parseThreeforms("the-apostles-creed");
  const niceneEnRaw = parseThreeforms("the-nicene-creed");
  const athanasianEnRaw = parseThreeforms("the-athanasian-creed");

  const apostlesZhRaw = parseCcctspm(9907);
  const niceneZhRaw = parseCcctspm(9908);
  const athanasianZhRaw = parseCcctspm(9909);
  const chalcedonZhRaw = parseCcctspm(10187);

  fs.writeFileSync(path.join(sourcesDir, "apostles-en.txt"), apostlesEnRaw);
  fs.writeFileSync(path.join(sourcesDir, "nicene-en.txt"), niceneEnRaw);
  fs.writeFileSync(path.join(sourcesDir, "athanasian-en.txt"), athanasianEnRaw);
  fs.writeFileSync(path.join(sourcesDir, "apostles-zh-ccctspm.txt"), apostlesZhRaw);
  fs.writeFileSync(path.join(sourcesDir, "nicene-zh-ccctspm.txt"), niceneZhRaw);
  fs.writeFileSync(path.join(sourcesDir, "athanasian-zh-ccctspm.txt"), athanasianZhRaw);
  fs.writeFileSync(path.join(sourcesDir, "chalcedon-zh-ccctspm.txt"), chalcedonZhRaw);
  fs.writeFileSync(path.join(sourcesDir, "chalcedon-en-npnf.txt"), CHALCEDON_EN);

  const body = {
    "apostles-creed": {
      bodyEn: splitApostlesEn(apostlesEnRaw),
      bodyZhTw: splitApostlesZh(apostlesZhRaw),
      bodyZh: splitApostlesZh(apostlesZhRaw).map(toSimplified),
    },
    "nicene-creed": {
      bodyEn: splitNiceneEn(niceneEnRaw),
      bodyZhTw: splitNiceneZh(niceneZhRaw),
      bodyZh: splitNiceneZh(niceneZhRaw).map(toSimplified),
    },
    "athanasian-creed": {
      bodyEn: splitAthanasianEn(athanasianEnRaw),
      bodyZhTw: splitAthanasianZh(athanasianZhRaw),
      bodyZh: splitAthanasianZh(athanasianZhRaw).map(toSimplified),
    },
    "chalcedonian-definition": {
      bodyEn: splitChalcedonEn(CHALCEDON_EN),
      bodyZhTw: splitChalcedonZh(chalcedonZhRaw),
      bodyZh: splitChalcedonZh(chalcedonZhRaw).map(toSimplified),
    },
  };

  const outFile = path.join(outDir, "ecumenical-creeds.generated.ts");
  fs.writeFileSync(
    outFile,
    `/** Generated by scripts/sync-ecumenical-creed-texts.mjs — do not edit by hand. */\nimport type { HistoricalCreedBodyContent } from "./types";\n\nexport const ECUMENICAL_CREED_BODIES: Record<string, HistoricalCreedBodyContent> = ${JSON.stringify(body, null, 2)};\n`,
  );

  console.log("Wrote", outFile);
  for (const [id, c] of Object.entries(body)) {
    console.log(id, "en", c.bodyEn.length, "zh", c.bodyZh.length, "zhTw", c.bodyZhTw.length);
  }
}

main();
