#!/usr/bin/env node
/**
 * D-44 同源离线 UI 胶囊生成器（web-pack.json）
 *
 * 读取仓库唯一真源：
 * - data/bible/panorama.json（六幕救赎故事 + 18 段灵修阅读指南 + 66 卷简介与经文线索）
 * - lib/bible/scripture-books.ts（66 卷序号 / OSIS ID / 简体书名 / 章数）
 * - apps/askbible-ios/AskBible/Model/BibleCatalog.swift（66 卷英文书名）
 * - lib/i18n/zh-tw-text.ts（简→繁转换真源）
 *
 * 生成单文件原子离线胶囊 `{ schemaVersion: 1, version, files: { "index.html", "app.css", "app.js" } }`
 * 并同步写入：
 * - public/v2/web-pack.json
 * - apps/askbible-ios/AskBible/Resources/web-pack.json
 * - apps/askbible-android/app/src/main/assets/web-pack.json
 *
 * 用法：
 *   node tools/build-web-pack.mjs          # 生成并写入三端产物
 *   node tools/build-web-pack.mjs --check  # 校验三端产物与真源 100% 一致且体量 < 60KB
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCRIPTURE_BOOK_NAME_EN } from "../lib/bible/scripture-book-names-en.ts";
import { scriptureBooks } from "../lib/bible/scripture-books.ts";
import { toZhTwText } from "../lib/i18n/zh-tw-text.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_PACK_BYTES = 64 * 1024;

const OUTPUT_TARGETS = [
  "public/v2/web-pack.json",
  ...(existsSync(path.join(ROOT, "apps/askbible-ios")) ? ["apps/askbible-ios/AskBible/Resources/web-pack.json"] : []),
  ...(existsSync(path.join(ROOT, "apps/askbible-android")) ? ["apps/askbible-android/app/src/main/assets/web-pack.json"] : []),
];

function readRepoFile(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

/** 序列化为无双引号的 JS 字面量，避免胶囊 JSON 外层转义膨胀 */
function toJsLiteral(val) {
  if (val === null) return "null";
  if (typeof val === "string") {
    if (!val.includes("`") && !val.includes("${") && !val.includes("\\") && !val.includes("\n") && !val.includes("\r") && val.includes("'")) {
      return "`" + val + "`";
    }
    return (
      "'" +
      val
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029") +
      "'"
    );
  }
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return "[" + val.map(toJsLiteral).join(",") + "]";
  const parts = [];
  for (const [k, v] of Object.entries(val)) {
    const keyOut = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : toJsLiteral(k);
    parts.push(keyOut + ":" + toJsLiteral(v));
  }
  return "{" + parts.join(",") + "}";
}

/** 从 BibleCatalog.swift（或无 apps/ 部署归档下的 TS 目录）解析 66 卷英文书名 */
function loadEnglishBookNames() {
  const swiftRel = "apps/askbible-ios/AskBible/Model/BibleCatalog.swift";
  if (existsSync(path.join(ROOT, swiftRel))) {
    const swift = readRepoFile(swiftRel);
    const enMap = new Map();
    for (const m of swift.matchAll(
      /BookRef\(number:\s*\d+,\s*id:\s*"(\w+)",\s*nameZh:\s*"[^"]+",\s*nameEn:\s*"([^"]+)",\s*chapterCount:\s*\d+\)/g,
    )) {
      enMap.set(m[1], m[2]);
    }
    return enMap;
  }
  return new Map(Object.entries({ ...SCRIPTURE_BOOK_NAME_EN, SNG: "Song of Solomon" }));
}

/** 从 zh-tw-text.ts 提取简繁转换表，并仅保留本胶囊用到的词组与单字 */
function buildMinimalZhTwTable(strings) {
  const src = readRepoFile("lib/i18n/zh-tw-text.ts");

  const extractBlock = (name) => {
    const idx = src.indexOf(`const ${name}`);
    if (idx < 0) throw new Error(`Cannot find const ${name} in lib/i18n/zh-tw-text.ts`);
    const eqIdx = src.indexOf("=", idx);
    const open = src.slice(eqIdx).search(/[\[{]/);
    const start = eqIdx + open;
    const openCh = src[start];
    const closeCh = openCh === "[" ? "]" : "}";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === openCh) depth++;
      else if (ch === closeCh && --depth === 0) {
        return src.slice(start, i + 1);
      }
    }
    throw new Error(`Unterminated block for ${name}`);
  };

  const phrasesRaw = extractBlock("ZH_TW_PHRASE_REPLACEMENTS");
  const charsRaw = extractBlock("ZH_TW_CHAR_MAP");
  const fixupsRaw = extractBlock("ZH_TW_POST_CHAR_MAP_FIXUPS");

  const phrases = [...phrasesRaw.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)].map((m) => [m[1], m[2]]);
  const fixups = [...fixupsRaw.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)].map((m) => [m[1], m[2]]);
  const charMap = new Map();
  for (const m of charsRaw.matchAll(/(?:"([^"]+)"|([^\s:,{}]+))\s*:\s*"([^"]+)"/g)) {
    const k = m[1] || m[2];
    if (k && m[3]) charMap.set(k, m[3]);
  }

  const corpus = strings.join("\n");
  const usedPhrases = phrases.filter(([from]) => corpus.includes(from));

  let afterPhrases = corpus;
  for (const [from, to] of usedPhrases) {
    afterPhrases = afterPhrases.replaceAll(from, to);
  }

  const usedChars = [];
  for (const ch of new Set(afterPhrases)) {
    const mapped = charMap.get(ch);
    if (mapped && mapped !== ch) {
      usedChars.push(ch + mapped);
    }
  }

  const charLookup = new Map(usedChars.map((pair) => [pair[0], pair[1]]));
  const afterChars = Array.from(afterPhrases, (c) => charLookup.get(c) ?? c).join("");
  const usedFixups = fixups.filter(([from]) => afterChars.includes(from));

  const miniConvert = (input) => {
    let out = input;
    for (const [from, to] of usedPhrases) out = out.replaceAll(from, to);
    out = Array.from(out, (c) => charLookup.get(c) ?? c).join("");
    for (const [from, to] of usedFixups) out = out.replaceAll(from, to);
    return out;
  };
  for (const s of strings) {
    const expected = toZhTwText(s);
    const actual = miniConvert(s);
    if (expected !== actual) {
      throw new Error(`zh-TW parity mismatch for "${s}": expected "${expected}", got "${actual}"`);
    }
  }

  return {
    p: usedPhrases,
    c: usedChars.join(""),
    f: usedFixups,
  };
}

function loadSourceData() {
  const panorama = JSON.parse(readRepoFile("data/bible/panorama.json"));
  const enBookNames = loadEnglishBookNames();

  if (scriptureBooks.length !== 66) {
    throw new Error(`Expected 66 books in scripture-books.ts, got ${scriptureBooks.length}`);
  }
  if (!Array.isArray(panorama.acts) || panorama.acts.length !== 6) {
    throw new Error(`Expected 6 acts in panorama.json, got ${panorama.acts?.length}`);
  }

  // 元组格式：[id, zh, en, ch, introZh, introEn, refs]（序号即 index + 1）
  const books = scriptureBooks.map((b) => {
    const en = enBookNames.get(b.bookId);
    if (!en) throw new Error(`Missing English name for ${b.bookId} in BibleCatalog.swift`);
    const intro = panorama.introductions?.[b.bookId];
    if (!intro) throw new Error(`Missing introduction for ${b.bookId} in panorama.json`);
    return [b.bookId, b.bookName, en, b.chapters, intro.zh, intro.en, intro.references || ""];
  });

  // 元组格式：[zh, en, subtitleZh, subtitleEn, [[id, zh, en, summaryZh, summaryEn, [[bookId, first, last], ...]], ...]]
  const acts = panorama.acts.map((act) => [
    act.zh,
    act.en,
    act.subtitleZh,
    act.subtitleEn,
    act.sections.map((sec) => [
      sec.id,
      sec.zh,
      sec.en,
      sec.summaryZh,
      sec.summaryEn,
      sec.spans.map((s) => [s.bookId, s.first, s.last]),
    ]),
  ]);

  // 字典：{ sectionId: [zh, en, [[bookId, ch, verses, kindZh, kindEn, reasonZh, reasonEn], ...]] }
  const notes = {};
  for (const act of panorama.acts) {
    for (const sec of act.sections) {
      const note = panorama.notes?.[sec.id];
      if (!note) throw new Error(`Missing reading note for section "${sec.id}" in panorama.json`);
      notes[sec.id] = [
        note.zh,
        note.en,
        (note.links || []).map((l) => [
          l.bookId,
          l.chapter,
          l.verses || "",
          l.kindZh,
          l.kindEn,
          l.reasonZh,
          l.reasonEn,
        ]),
      ];
    }
  }

  const uiZhStrings = [
    "救赎全景",
    "在完整的救赎故事中，读懂每一卷书在写什么",
    "书卷速查",
    "✦ 你正在这一幕 · 第 {n} 幕",
    "✦ 救赎历史起点 · 第 1 幕",
    "接着阅读 · {book} 第 {ch} 章",
    "从起初进入 · 创世记 第 1 章",
    "在下方定位",
    "当前所在",
    "卷",
    "共 {n} 章",
    "第 {a}–{b} 章",
    "在读",
    "收起",
    "选章 ›",
    "核心经文线索：",
    "读第 {n} 章 →",
    "六幕为灵修导览脉络，帮助你在救赎历史中读懂每一卷书在写什么。",
    "66 卷书都在写什么",
    "搜书名或主题关键词…",
    "进入阅读 ›",
    "未找到匹配的书卷",
    "壹",
    "贰",
    "叁",
    "肆",
    "伍",
    "陆",
  ];

  const allZhStrings = [...uiZhStrings];
  for (const b of books) allZhStrings.push(b[1], b[4]);
  for (const a of acts) {
    allZhStrings.push(a[0], a[2]);
    for (const s of a[4]) {
      allZhStrings.push(s[1], s[3]);
      const n = notes[s[0]];
      allZhStrings.push(n[0]);
      for (const l of n[2]) allZhStrings.push(l[3], l[5]);
    }
  }

  const tw = buildMinimalZhTwTable(allZhStrings);
  return { books, acts, notes, tw };
}

function buildSelfContainedHtml(appCss, appJs) {
  return (
    "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'>" +
    "<title>AskBible.me</title>" +
    "<style>" + appCss + "</style>" +
    "<!--__ASKBIBLE_INIT_SLOT__-->" +
    "</head><body><div id='app'></div><script>" + appJs + "</script></body></html>"
  );
}

function buildAppCss() {
  return [
    ":root{--canvas:#ecd9b9;--ink:#1c1410;--ink-soft:rgba(28,20,16,0.94);--muted:#5c4030;--faint:#6e5240;--border:rgba(120,53,15,0.28);--border-strong:rgba(120,53,15,0.42);--accent:#C1660B;--accent-soft:rgba(193,102,11,0.12);--accent-line:rgba(193,102,11,0.35);--surface:rgba(255,252,245,0.88);--surface-dim:rgba(255,252,245,0.62);--card:rgba(255,252,245,0.72);--chapter-bg:#f5ead8;--chapter-border:rgba(120,53,15,0.30);--modal-backdrop:rgba(28,20,16,0.45);--modal-bg:#f5ebe0;--cta-fg:#fffdf9;--shadow:0 4px 14px rgba(28,20,16,0.07);--font-scale:1;--inset-top:0px;--inset-bottom:0px;}",
    "html[data-theme='dark']{--canvas:#1a1512;--ink:#f4ebe1;--ink-soft:rgba(244,235,225,0.94);--muted:#d8c8b4;--faint:#b9a896;--border:rgba(244,235,225,0.16);--border-strong:rgba(244,235,225,0.24);--accent:#E2A84B;--accent-soft:rgba(226,168,75,0.14);--accent-line:rgba(226,168,75,0.35);--surface:rgba(41,37,36,0.80);--surface-dim:rgba(41,37,36,0.52);--card:rgba(26,21,18,0.64);--chapter-bg:rgba(63,58,54,0.66);--chapter-border:rgba(244,235,225,0.18);--modal-backdrop:rgba(12,10,8,0.64);--modal-bg:#26201c;--cta-fg:#1a1511;--shadow:0 4px 16px rgba(0,0,0,0.28);}",
    "*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}",
    "html,body{margin:0;padding:0;min-height:100%;background:var(--canvas);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif;font-size:calc(16px * var(--font-scale));line-height:1.5;overscroll-behavior:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-text-size-adjust:100%;}",
    "html[data-embedded='0'] body{background:var(--canvas);}",
    "button,input{font-family:inherit;color:inherit;}input{-webkit-user-select:text;user-select:text;}button{border:0;background:transparent;padding:0;margin:0;text-align:left;cursor:pointer;}",
    ".wrap{max-width:520px;margin:0 auto;padding:calc(max(var(--inset-top),env(safe-area-inset-top,0px)) + 18px) 20px calc(max(var(--inset-bottom),env(safe-area-inset-bottom,0px)) + 28px);}",
    ".hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px;}.hdr-text{min-width:0;flex:1;}.hdr-title{margin:0;font-size:1.75rem;font-weight:700;letter-spacing:-0.015em;line-height:1.2;color:var(--ink);}.hdr-sub{margin:5px 0 0;font-size:0.84rem;line-height:1.45;color:var(--muted);}",
    ".finder-btn{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;margin-top:4px;padding:7px 12px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface);color:var(--accent);font-size:0.78rem;font-weight:600;box-shadow:var(--shadow);}.finder-btn svg{width:14px;height:14px;flex-shrink:0;}",
    ".hero{border-radius:20px;border:1px solid var(--border-strong);background:var(--surface);padding:16px;margin-bottom:20px;box-shadow:var(--shadow);}.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}.hero-meta{min-width:0;flex:1;}",
    ".hero-pill{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--accent);color:var(--cta-fg);font-size:0.72rem;font-weight:700;letter-spacing:0.01em;}",
    ".hero-title{margin:9px 0 0;font-size:1.18rem;font-weight:700;line-height:1.32;color:var(--ink);}",
    ".hero-sum{margin:5px 0 0;font-size:0.83rem;line-height:1.5;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}",
    ".hero-art{width:64px;height:66px;flex-shrink:0;margin-top:2px;}.hero-actions{display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap;}",
    ".hero-cta{flex:1;min-width:190px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 15px;border-radius:12px;background:var(--accent);color:var(--cta-fg);font-size:0.88rem;font-weight:700;}.hero-cta-txt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".hero-locate{padding:8px 10px;border-radius:10px;color:var(--accent);font-size:0.8rem;font-weight:600;white-space:nowrap;}",
    ".timeline{position:relative;display:flex;flex-direction:column;gap:12px;}.act-row{position:relative;display:flex;align-items:flex-start;gap:12px;scroll-margin-top:calc(max(var(--inset-top),env(safe-area-inset-top,0px)) + 14px);}",
    ".act-rail{position:absolute;left:5px;top:24px;bottom:-14px;width:1.5px;background:var(--accent-line);pointer-events:none;}",
    ".act-dot{width:11px;height:11px;border-radius:999px;flex-shrink:0;margin-top:18px;border:2px solid var(--accent);background:var(--canvas);position:relative;z-index:1;}",
    ".act-row.is-open .act-dot,.act-row.is-cur .act-dot{background:var(--accent);}",
    ".act-card{min-width:0;flex:1;border-radius:18px;border:1px solid var(--border);background:var(--surface-dim);transition:border-color .15s ease,background .15s ease;}",
    ".act-row.is-open .act-card{border-color:var(--border-strong);background:var(--surface);box-shadow:var(--shadow);}.act-row.is-cur .act-card{border-color:var(--accent);}",
    ".act-head{width:100%;display:flex;align-items:center;gap:10px;padding:13px 14px;}",
    ".act-num{width:28px;height:28px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;background:var(--accent-soft);color:var(--accent);}",
    ".act-row.is-open .act-num,.act-row.is-cur .act-num{background:var(--accent);color:var(--cta-fg);}.act-sketch{width:40px;height:42px;flex-shrink:0;}",
    ".act-titles{min-width:0;flex:1;}.act-name-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}.act-name{font-size:1.05rem;font-weight:700;color:var(--ink);}.act-here{font-size:0.7rem;font-weight:700;color:var(--accent);}",
    ".act-sub{font-size:0.81rem;color:var(--muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.act-chev{font-size:0.88rem;color:var(--faint);flex-shrink:0;padding-left:4px;}",
    ".act-body{padding:0 14px 14px;display:flex;flex-direction:column;gap:16px;}.sec-block{border-top:1px solid var(--border);padding-top:13px;display:flex;flex-direction:column;gap:9px;}",
    ".sec-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;}.sec-title{margin:0;font-size:0.96rem;font-weight:700;color:var(--accent);}.sec-count{font-size:0.76rem;font-weight:600;color:var(--muted);flex-shrink:0;}.sec-sum{margin:0;font-size:0.84rem;line-height:1.55;color:var(--muted);}",
    ".note-box{border-radius:12px;border:1px solid var(--border);background:var(--accent-soft);padding:10px 11px;display:flex;flex-direction:column;gap:7px;}.note-txt{margin:0;font-size:0.8rem;line-height:1.52;color:var(--ink-soft);}",
    ".note-link{width:100%;display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:var(--card);}.note-bar{width:2.5px;height:24px;border-radius:999px;background:var(--accent);flex-shrink:0;}.note-link-body{min-width:0;flex:1;}.note-link-title{display:block;font-size:0.81rem;font-weight:700;color:var(--ink);}.note-link-reason{display:block;font-size:0.75rem;line-height:1.42;color:var(--muted);margin-top:2px;}.note-link-arrow{color:var(--accent);font-size:1rem;font-weight:700;flex-shrink:0;}",
    ".book-list{display:flex;flex-direction:column;gap:9px;padding-top:2px;}.book-card{border-radius:13px;border:1px solid var(--border);background:var(--card);padding:12px;}.book-card.is-cur{border-color:var(--accent);background:var(--accent-soft);}.book-btn{width:100%;}",
    ".book-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}.book-left{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap;}.book-name{font-size:0.96rem;font-weight:700;color:var(--ink);}.book-span{padding:2px 7px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:0.69rem;font-weight:700;white-space:nowrap;}.book-reading{padding:2px 6px;border-radius:999px;background:var(--accent);color:var(--cta-fg);font-size:0.66rem;font-weight:700;white-space:nowrap;}.book-toggle{font-size:0.76rem;font-weight:700;color:var(--accent);flex-shrink:0;}",
    ".book-intro{margin:6px 0 0;font-size:0.83rem;line-height:1.54;color:var(--ink-soft);}.book-quick{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:0.77rem;font-weight:700;color:var(--accent);}",
    ".book-expand{margin-top:10px;border-top:1px solid var(--border);padding-top:10px;}.book-refs{margin:0 0 9px;font-size:0.76rem;line-height:1.45;color:var(--muted);}",
    ".ch-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;}.ch-cell{height:36px;border-radius:8px;border:1px solid var(--chapter-border);background:var(--chapter-bg);color:var(--ink);font-size:0.84rem;font-weight:600;display:flex;align-items:center;justify-content:center;}.ch-cell.is-cur{border-color:var(--accent);background:var(--accent);color:var(--cta-fg);font-weight:700;}",
    ".footer-note{margin:18px 2px 0;font-size:0.76rem;line-height:1.55;color:var(--faint);}",
    ".modal-backdrop{position:fixed;inset:0;z-index:99;background:var(--modal-backdrop);display:flex;align-items:flex-end;justify-content:center;padding:14px 14px calc(max(var(--inset-bottom),env(safe-area-inset-bottom,0px)) + 14px);}@media(min-width:560px){.modal-backdrop{align-items:center;}}",
    ".modal-sheet{width:100%;max-width:440px;max-height:80vh;display:flex;flex-direction:column;border-radius:20px;border:1px solid var(--border-strong);background:var(--modal-bg);padding:16px;box-shadow:0 18px 40px rgba(0,0,0,0.28);}.modal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}.modal-title{margin:0;font-size:1.08rem;font-weight:700;color:var(--ink);}.modal-close{width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;color:var(--muted);}",
    ".modal-search{width:100%;height:38px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);padding:0 12px;font-size:0.88rem;color:var(--ink);outline:none;margin-bottom:10px;}.modal-search::placeholder{color:var(--faint);}",
    ".modal-list{min-height:0;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px;}.modal-item{width:100%;border-radius:12px;border:1px solid var(--border);background:var(--surface);padding:11px 12px;}.modal-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}.modal-item-name{font-size:0.9rem;font-weight:700;color:var(--ink);}.modal-item-go{font-size:0.76rem;font-weight:700;color:var(--accent);flex-shrink:0;}.modal-item-desc{margin:4px 0 0;font-size:0.79rem;line-height:1.48;color:var(--muted);}.modal-empty{padding:24px 8px;text-align:center;font-size:0.84rem;color:var(--muted);}",
  ].join("");
}

function buildAppJs(data, version) {
  const payloadLiteral = toJsLiteral(data);
  const raw = `(function(){
'use strict';
var VERSION=${toJsLiteral(version)};
var DATA=${payloadLiteral};
var BOOK_BY_ID={};
for(var i=0;i<DATA.books.length;i++){BOOK_BY_ID[DATA.books[i][0]]=DATA.books[i];}
var TW_CHAR_MAP={};
for(var j=0;j<DATA.tw.c.length;j+=2){TW_CHAR_MAP[DATA.tw.c[j]]=DATA.tw.c[j+1];}
function toTw(str){
  if(!str)return '';
  var out=str,ps=DATA.tw.p,fs=DATA.tw.f;
  for(var i=0;i<ps.length;i++){if(out.indexOf(ps[i][0])!==-1)out=out.split(ps[i][0]).join(ps[i][1]);}
  var chars='';
  for(var k=0;k<out.length;k++){var ch=out.charAt(k);chars+=TW_CHAR_MAP[ch]||ch;}
  out=chars;
  for(var m=0;m<fs.length;m++){if(out.indexOf(fs[m][0])!==-1)out=out.split(fs[m][0]).join(fs[m][1]);}
  return out;
}
function parseParams(){
  if(window.__ASKBIBLE_INIT__&&typeof window.__ASKBIBLE_INIT__==='object'){
    var p=window.__ASKBIBLE_INIT__;
    var pb=String(p.book||'').trim().toUpperCase();
    var pch=Number(p.ch||1);
    if(!isFinite(pch)||pch<1)pch=1;
    var psc=Number(p.scale||1);
    if(!isFinite(psc)||psc<=0)psc=1;
    return{
      locale:String(p.locale||'zh-CN'),
      dark:Boolean(p.dark),
      scale:psc,
      book:pb||'GEN',
      ch:Math.floor(pch),
      hasHistory:typeof p.hasHistory==='boolean'?p.hasHistory:Boolean(pb),
      locateRequest:Number(p.locateRequest||0)||0,
      topInset:Number(p.topInset||0)||0,
      bottomInset:Number(p.bottomInset||0)||0
    };
  }
  var q=new URLSearchParams(location.search||'');
  if(!q.toString()&&location.hash&&location.hash.indexOf('?')!==-1){
    q=new URLSearchParams(location.hash.split('?')[1]);
  }
  var book=(q.get('book')||'').toUpperCase();
  var ch=parseInt(q.get('ch')||'1',10);
  if(!isFinite(ch)||ch<1)ch=1;
  var hasHistory=q.has('hasHistory')?(q.get('hasHistory')==='1'||q.get('hasHistory')==='true'):Boolean(book);
  var scale=parseFloat(q.get('scale')||'1');
  if(!isFinite(scale)||scale<=0)scale=1;
  return{
    locale:q.get('locale')||'zh-CN',
    dark:q.get('dark')==='1'||q.get('dark')==='true',
    scale:scale,
    book:book||'GEN',
    ch:ch,
    hasHistory:hasHistory,
    locateRequest:parseInt(q.get('locateRequest')||'0',10)||0,
    topInset:parseFloat(q.get('topInset')||'0')||0,
    bottomInset:parseFloat(q.get('bottomInset')||'0')||0
  };
}
function findLocation(bookId,chapter){
  var bid=(bookId||'GEN').toUpperCase();
  var order=bid==='REV'&&chapter>=21?[5,4]:[0,1,2,3,4,5];
  for(var oi=0;oi<order.length;oi++){
    var actIdx=order[oi],act=DATA.acts[actIdx];
    if(!act)continue;
    for(var si=0;si<act[4].length;si++){
      var sec=act[4][si];
      for(var pi=0;pi<sec[5].length;pi++){
        var sp=sec[5][pi];
        if(sp[0]===bid&&chapter>=sp[1]&&chapter<=sp[2])return{actIndex:actIdx,section:sec};
      }
    }
  }
  return{actIndex:0,section:DATA.acts[0][4][0]};
}
var init=parseParams();
var initLoc=findLocation(init.book,init.ch);
var state={
  locale:init.locale,dark:init.dark,scale:init.scale,
  book:init.book,ch:init.ch,hasHistory:init.hasHistory,
  locateRequest:init.locateRequest,topInset:init.topInset,bottomInset:init.bottomInset,
  activeAct:initLoc.actIndex,expandedSections:{},expandedBookKey:null,finderOpen:false,finderQuery:''
};
state.expandedSections[initLoc.section[0]]=true;
var ACT_NUMERALS=['壹','贰','叁','肆','伍','陆'];
function t(zh,en){
  if(state.locale==='en')return en;
  return state.locale==='zh-TW'?toTw(zh):zh;
}
function bookName(bookId){
  var b=BOOK_BY_ID[bookId];
  if(!b)return bookId;
  if(state.locale==='en')return b[2];
  return state.locale==='zh-TW'?toTw(b[1]):b[1];
}
function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}
function sketchSvg(stage,cls){
  var inner='<path d="M5 70 C30 62 65 63 95 70" stroke-width="1.4"/>';
  if(stage===0||stage===1||stage===5){
    inner+='<line x1="48" y1="64" x2="50" y2="25" stroke-width="1.5"/>'
      +'<line x1="50" y1="47" x2="28" y2="28" stroke-width="1.4"/>'
      +'<line x1="50" y1="43" x2="73" y2="22" stroke-width="1.4"/>'
      +'<line x1="50" y1="35" x2="43" y2="15" stroke-width="1.4"/>';
    if(stage!==1){
      var pts=[[25,24],[40,18],[57,16],[73,23],[34,36],[65,36]];
      for(var i=0;i<pts.length;i++)inner+='<circle cx="'+pts[i][0]+'" cy="'+pts[i][1]+'" r="12" fill="var(--accent-soft)" stroke-width="1.1"/>';
    }
    if(stage===0)inner+='<circle cx="87" cy="12" r="5.5" fill="var(--accent-soft)" stroke-width="1.2"/>';
    if(stage===5)inner+='<path d="M58 65 C95 72 15 73 40 80 M67 65 C105 74 38 74 54 80" stroke-width="1.2"/>';
  }else if(stage===2){
    inner+='<polygon points="17,64 48,24 80,64" fill="var(--accent-soft)" stroke-width="1.5"/>'
      +'<line x1="48" y1="24" x2="48" y2="64" stroke-width="1.3"/><line x1="48" y1="24" x2="63" y2="64" stroke-width="1.3"/>';
    var stars=[[15,14],[72,10],[87,28],[35,7]];
    for(var s=0;s<stars.length;s++){
      var x=stars[s][0],y=stars[s][1];
      inner+='<line x1="'+(x-3)+'" y1="'+y+'" x2="'+(x+3)+'" y2="'+y+'" stroke-width="1.2"/><line x1="'+x+'" y1="'+(y-3)+'" x2="'+x+'" y2="'+(y+3)+'" stroke-width="1.2"/>';
    }
  }else if(stage===3){
    inner+='<circle cx="52" cy="52" r="24" fill="var(--accent-soft)" stroke="none"/>'
      +'<path d="M43 61 L43 28 L30 28 L30 21 L43 21 L43 8 L51 8 L51 21 L64 21 L64 28 L51 28 L51 61" fill="var(--accent-soft)" stroke-width="1.5"/>';
  }else{
    inner+='<path d="M40 72 C65 45 18 44 25 14 M48 72 C78 42 65 39 70 8 M56 72 C85 47 80 37 96 28" stroke-width="1.4"/>'
      +'<path d="M19 22 L25 14 L31 21 M63 17 L70 8 L76 17 M86 29 L96 28 L94 38" stroke-width="1.4"/>';
  }
  return '<svg class="'+cls+'" viewBox="0 0 100 82" stroke="var(--accent)" stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true">'+inner+'</svg>';
}
function sendNative(action,payload){
  try{
    if(window.askbibleNative&&typeof window.askbibleNative.send==='function'){window.askbibleNative.send(action,payload||{});return true;}
    if(window.askbibleNativeBridge&&typeof window.askbibleNativeBridge.postMessage==='function'){window.askbibleNativeBridge.postMessage(action,JSON.stringify(payload||{}));return true;}
    if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.askbibleNative){window.webkit.messageHandlers.askbibleNative.postMessage({action:action,payload:payload||{}});return true;}
  }catch(_){}
  return false;
}
function applyThemeVars(){
  var r=document.documentElement;
  r.dataset.theme=state.dark?'dark':'light';
  r.dataset.locale=state.locale;
  r.dataset.embedded=(window.askbibleNative||window.askbibleNativeBridge||(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.askbibleNative))?'1':'0';
  r.style.setProperty('--font-scale',String(state.scale));
  r.style.setProperty('--inset-top',state.topInset+'px');
  r.style.setProperty('--inset-bottom',state.bottomInset+'px');
}
function render(){
  applyThemeVars();
  var rootEl=document.getElementById('app');
  if(!rootEl)return;
  var heroLoc=findLocation(state.book,state.ch),heroActIdx=heroLoc.actIndex;
  var heroAct=DATA.acts[heroActIdx]||DATA.acts[0],heroSec=heroLoc.section||heroAct[4][0];
  var curBookName=bookName(state.book);
  var pillText=state.hasHistory
    ?t('✦ 你正在这一幕 · 第 '+(heroActIdx+1)+' 幕','✦ You are here · Act '+(heroActIdx+1))
    :t('✦ 救赎历史起点 · 第 1 幕','✦ Where the story begins · Act 1');
  var ctaText=state.hasHistory
    ?t('接着阅读 · '+curBookName+' 第 '+state.ch+' 章','Continue · '+curBookName+' '+state.ch)
    :t('从起初进入 · 创世记 第 1 章','Begin from Genesis 1');
  var h='<div class="wrap"><header class="hdr"><div class="hdr-text">'
    +'<h1 class="hdr-title">'+esc(t('救赎全景','Redemption Story'))+'</h1>'
    +'<p class="hdr-sub">'+esc(t('在完整的救赎故事中，读懂每一卷书在写什么','Understand what every book of Scripture is about within one redemptive story'))+'</p></div>'
    +'<button type="button" class="finder-btn" data-act="open-finder">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg>'
    +'<span>'+esc(t('书卷速查','66 Books'))+'</span></button></header>';
  h+='<section class="hero"><div class="hero-top"><div class="hero-meta">'
    +'<span class="hero-pill">'+esc(pillText)+'</span>'
    +'<h2 class="hero-title">'+esc(t(heroAct[0],heroAct[1])+' · '+t(heroSec[1],heroSec[2]))+'</h2>'
    +'<p class="hero-sum">'+esc(t(heroSec[3],heroSec[4]))+'</p></div>'+sketchSvg(heroActIdx,'hero-art')+'</div>'
    +'<div class="hero-actions"><button type="button" class="hero-cta" data-act="hero-go"><span class="hero-cta-txt">'+esc(ctaText)+'</span><span aria-hidden="true">›</span></button>';
  if(state.hasHistory)h+='<button type="button" class="hero-locate" data-act="locate">'+esc(t('在下方定位','Locate below'))+'</button>';
  h+='</div></section><div class="timeline">';
  for(var ai=0;ai<DATA.acts.length;ai++){
    var act=DATA.acts[ai],isOpen=state.activeAct===ai,isCurAct=heroActIdx===ai;
    var badge=state.locale==='en'?String(ai+1):t(ACT_NUMERALS[ai]||String(ai+1),String(ai+1));
    h+='<div class="act-row'+(isOpen?' is-open':'')+(isCurAct?' is-cur':'')+'" id="act-'+ai+'">';
    if(ai<DATA.acts.length-1)h+='<span class="act-rail" aria-hidden="true"></span>';
    h+='<span class="act-dot" aria-hidden="true"></span><div class="act-card">'
      +'<button type="button" class="act-head" data-act="toggle-act" data-idx="'+ai+'">'
      +'<span class="act-num">'+esc(badge)+'</span>'+sketchSvg(ai,'act-sketch')
      +'<div class="act-titles"><div class="act-name-line"><span class="act-name">'+esc(t(act[0],act[1]))+'</span>';
    if(isCurAct&&!isOpen)h+='<span class="act-here">'+esc(t('当前所在','Here'))+'</span>';
    h+='</div><div class="act-sub">'+esc(t(act[2],act[3]))+'</div></div><span class="act-chev" aria-hidden="true">'+(isOpen?'▴':'▾')+'</span></button>';
    if(isOpen){
      h+='<div class="act-body">';
      var secs=act[4],alwaysOpen=secs.length<=2;
      for(var si=0;si<secs.length;si++){
        var sec=secs[si],secId=sec[0],secOpen=alwaysOpen||Boolean(state.expandedSections[secId]);
        h+='<div class="sec-block" id="sec-'+esc(secId)+'">';
        if(alwaysOpen){
          h+='<div class="sec-head"><h3 class="sec-title">'+esc(t(sec[1],sec[2]))+'</h3></div>';
        }else{
          h+='<button type="button" class="sec-head" data-act="toggle-sec" data-sec="'+esc(secId)+'">'
            +'<h3 class="sec-title">'+esc(t(sec[1],sec[2]))+'</h3>'
            +'<span class="sec-count">'+sec[5].length+' '+esc(t('卷','books'))+(secOpen?' ▴':' ▾')+'</span></button>';
        }
        h+='<p class="sec-sum">'+esc(t(sec[3],sec[4]))+'</p>';
        if(secOpen){
          var note=DATA.notes[secId];
          if(note){
            h+='<div class="note-box"><p class="note-txt">'+esc(t(note[0],note[1]))+'</p>';
            for(var li=0;li<note[2].length;li++){
              var lk=note[2][li],ref=bookName(lk[0])+' '+lk[1]+(lk[2]?':'+lk[2]:'');
              h+='<button type="button" class="note-link" data-act="read" data-book="'+esc(lk[0])+'" data-ch="'+lk[1]+'">'
                +'<span class="note-bar" aria-hidden="true"></span>'
                +'<span class="note-link-body"><span class="note-link-title">'+esc(t(lk[3],lk[4])+' · '+ref)+'</span>'
                +'<span class="note-link-reason">'+esc(t(lk[5],lk[6]))+'</span></span>'
                +'<span class="note-link-arrow" aria-hidden="true">›</span></button>';
            }
            h+='</div>';
          }
          h+='<div class="book-list">';
          for(var bi=0;bi<sec[5].length;bi++){
            var sp=sec[5][bi],bId=sp[0],spFirst=sp[1],spLast=sp[2],bObj=BOOK_BY_ID[bId];
            if(!bObj)continue;
            var cardKey=secId+':'+bId+':'+spFirst+'-'+spLast,cardOpen=state.expandedBookKey===cardKey;
            var isCurSpan=state.hasHistory&&state.book===bId&&state.ch>=spFirst&&state.ch<=spLast;
            var rangeText=(spFirst===1&&spLast===bObj[3])?t('共 '+bObj[3]+' 章',bObj[3]+' chs'):t('第 '+spFirst+'–'+spLast+' 章','Ch. '+spFirst+'–'+spLast);
            h+='<div class="book-card'+(isCurSpan?' is-cur':'')+'"><button type="button" class="book-btn" data-act="toggle-book" data-key="'+esc(cardKey)+'">'
              +'<div class="book-top"><div class="book-left"><span class="book-name">'+esc(bookName(bId))+'</span>'
              +'<span class="book-span">'+esc(rangeText)+'</span>';
            if(isCurSpan)h+='<span class="book-reading">'+esc(t('在读','Reading'))+'</span>';
            h+='</div><span class="book-toggle">'+esc(cardOpen?t('收起','Hide'):t('选章 ›','Chapters ›'))+'</span></div>'
              +'<p class="book-intro">'+esc(t(bObj[4],bObj[5]))+'</p></button>';
            if(cardOpen){
              h+='<div class="book-expand">';
              if(bObj[6])h+='<p class="book-refs">'+esc(t('核心经文线索：','Key passages: ')+bObj[6])+'</p>';
              h+='<div class="ch-grid">';
              for(var ch=spFirst;ch<=spLast;ch++){
                h+='<button type="button" class="ch-cell'+(isCurSpan&&state.ch===ch?' is-cur':'')+'" data-act="read" data-book="'+esc(bId)+'" data-ch="'+ch+'">'+ch+'</button>';
              }
              h+='</div></div>';
            }else{
              var quickLabel=spFirst===1?t('读第 1 章 →','Read Ch. 1 →'):t('读第 '+spFirst+' 章 →','Read Ch. '+spFirst+' →');
              h+='<button type="button" class="book-quick" data-act="read" data-book="'+esc(bId)+'" data-ch="'+spFirst+'">'+esc(quickLabel)+'</button>';
            }
            h+='</div>';
          }
          h+='</div>';
        }
        h+='</div>';
      }
      h+='</div>';
    }
    h+='</div></div>';
  }
  h+='</div><p class="footer-note">'+esc(t('六幕为灵修导览脉络，帮助你在救赎历史中读懂每一卷书在写什么。','The six acts serve as a devotional story guide introducing what every book of Scripture is about.'))+'</p></div>';
  if(state.finderOpen){
    h+='<div class="modal-backdrop" data-act="close-finder"><div class="modal-sheet" data-stop="1">'
      +'<div class="modal-hdr"><h3 class="modal-title">'+esc(t('66 卷书都在写什么','66 Books Overview'))+'</h3>'
      +'<button type="button" class="modal-close" data-act="close-finder" aria-label="Close">×</button></div>'
      +'<input id="finder-input" type="search" class="modal-search" value="'+esc(state.finderQuery)+'" placeholder="'+esc(t('搜书名或主题关键词…','Search book or theme…'))+'">'
      +'<div class="modal-list" id="finder-list">'+renderFinderList(state.finderQuery)+'</div></div></div>';
  }
  rootEl.innerHTML=h;
  if(state.finderOpen){
    var inp=document.getElementById('finder-input');
    if(inp){
      inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);
      inp.oninput=function(e){state.finderQuery=e.target.value||'';var l=document.getElementById('finder-list');if(l)l.innerHTML=renderFinderList(state.finderQuery);};
    }
  }
}
function renderFinderList(query){
  var q=(query||'').trim().toLowerCase(),items=[];
  for(var i=0;i<DATA.books.length;i++){
    var b=DATA.books[i],dn=bookName(b[0]);
    if(q){
      var hay=(dn+' '+b[1]+' '+toTw(b[1])+' '+b[2]+' '+b[0]+' '+b[4]+' '+toTw(b[4])+' '+b[5]).toLowerCase();
      if(hay.indexOf(q)===-1)continue;
    }
    var n=i+1,numStr=(n<10?'0':'')+n;
    items.push('<button type="button" class="modal-item" data-act="finder-read" data-book="'+esc(b[0])+'">'
      +'<div class="modal-item-top"><span class="modal-item-name">'+numStr+' · '+esc(dn)+'</span>'
      +'<span class="modal-item-go">'+esc(t('进入阅读 ›','Read ›'))+'</span></div>'
      +'<p class="modal-item-desc">'+esc(t(b[4],b[5]))+'</p></button>');
  }
  return items.length?items.join(''):'<div class="modal-empty">'+esc(t('未找到匹配的书卷','No matching books'))+'</div>';
}
function scrollToAct(actIdx){
  var el=document.getElementById('act-'+actIdx);
  if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'});
}
document.addEventListener('click',function(e){
  var target=e.target;
  while(target&&target!==document){
    if(target.dataset&&target.dataset.stop)return;
    if(target.dataset&&target.dataset.act){
      var act=target.dataset.act;
      if(act==='open-finder'){state.finderOpen=true;state.finderQuery='';render();return;}
      if(act==='close-finder'){state.finderOpen=false;render();return;}
      if(act==='finder-read'){state.finderOpen=false;render();sendNative('openChapter',{bookId:target.dataset.book,chapter:1});return;}
      if(act==='hero-go'){
        if(state.hasHistory)sendNative('resumeReading',{});
        else sendNative('openChapter',{bookId:'GEN',chapter:1});
        return;
      }
      if(act==='locate'){
        var loc=findLocation(state.book,state.ch);
        state.activeAct=loc.actIndex;state.expandedSections[loc.section[0]]=true;
        render();setTimeout(function(){scrollToAct(loc.actIndex);},40);return;
      }
      if(act==='toggle-act'){var idx=parseInt(target.dataset.idx,10);state.activeAct=(state.activeAct===idx)?-1:idx;render();return;}
      if(act==='toggle-sec'){var sid=target.dataset.sec;state.expandedSections[sid]=!state.expandedSections[sid];render();return;}
      if(act==='toggle-book'){var k=target.dataset.key;state.expandedBookKey=(state.expandedBookKey===k)?null:k;render();return;}
      if(act==='read'){sendNative('openChapter',{bookId:target.dataset.book,chapter:parseInt(target.dataset.ch,10)||1});return;}
    }
    target=target.parentNode;
  }
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&state.finderOpen){state.finderOpen=false;render();}});
window.askbibleUpdateState=function(next){
  if(!next||typeof next!=='object')return;
  var prevBook=state.book,prevCh=state.ch,prevLocate=state.locateRequest;
  if(typeof next.locale==='string'&&next.locale)state.locale=next.locale;
  if(typeof next.dark==='boolean')state.dark=next.dark;
  if(typeof next.scale==='number'&&isFinite(next.scale)&&next.scale>0)state.scale=next.scale;
  if(typeof next.topInset==='number'&&isFinite(next.topInset))state.topInset=next.topInset;
  if(typeof next.bottomInset==='number'&&isFinite(next.bottomInset))state.bottomInset=next.bottomInset;
  if(typeof next.hasHistory==='boolean')state.hasHistory=next.hasHistory;
  if(typeof next.book==='string'){
    var nb=next.book.trim().toUpperCase();
    state.book=nb||'GEN';
    if(typeof next.hasHistory!=='boolean')state.hasHistory=Boolean(nb);
  }
  if(typeof next.ch==='number'&&isFinite(next.ch)&&next.ch>=1)state.ch=Math.floor(next.ch);
  var locChanged=state.book!==prevBook||state.ch!==prevCh;
  var locateBump=typeof next.locateRequest==='number'&&next.locateRequest>prevLocate;
  if(locateBump)state.locateRequest=next.locateRequest;
  if(locChanged||locateBump){
    var loc=findLocation(state.book,state.ch);
    state.activeAct=loc.actIndex;state.expandedSections[loc.section[0]]=true;
  }
  render();
  if(locateBump){
    var targetIdx=findLocation(state.book,state.ch).actIndex;
    setTimeout(function(){scrollToAct(targetIdx);},40);
  }
};
render();
var appNode=document.getElementById('app');
if(appNode&&appNode.children.length>0)sendNative('bootHealthy',{version:VERSION});
})();`;
  const compact = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("");
  // 验证生成的 JS 语法无误
  new Function(compact);
  return compact;
}

function generateCapsule() {
  const data = loadSourceData();
  const appCss = buildAppCss();
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ data, appCss }))
    .digest("hex")
    .slice(0, 12);
  const appJs = buildAppJs(data, contentHash);
  const indexHtml = buildSelfContainedHtml(appCss, appJs);

  const files = {
    "index.html": indexHtml,
    "app.js": "/* inlined in index.html */",
  };
  const capsule = {
    schemaVersion: 1,
    version: contentHash,
    files,
  };
  const serialized = JSON.stringify(capsule);
  const byteLength = Buffer.byteLength(serialized, "utf8");
  return { capsule, serialized, byteLength };
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const { capsule, serialized, byteLength } = generateCapsule();

  if (byteLength >= MAX_PACK_BYTES) {
    console.error(`FAIL: web-pack.json size ${byteLength} bytes exceeds limit ${MAX_PACK_BYTES} bytes`);
    process.exit(1);
  }

  const sha256 = createHash("sha256").update(serialized, "utf8").digest("hex");

  if (checkOnly) {
    let failures = 0;
    for (const rel of OUTPUT_TARGETS) {
      const abs = path.join(ROOT, rel);
      let existing;
      try {
        existing = readFileSync(abs, "utf8");
      } catch {
        console.error(`FAIL: missing ${rel}`);
        failures++;
        continue;
      }
      if (existing !== serialized) {
        console.error(`FAIL: ${rel} is out of date with source data/builder`);
        failures++;
      }
    }
    if (failures > 0) {
      console.error(`web-pack --check failed (${failures} target(s)); run: node tools/build-web-pack.mjs`);
      process.exit(1);
    }
    console.log(
      `PASS: web-pack.json verified across ${OUTPUT_TARGETS.length} targets (version=${capsule.version}, size=${byteLength} B, sha256=${sha256.slice(0, 16)}...)`,
    );
    return;
  }

  for (const rel of OUTPUT_TARGETS) {
    const abs = path.join(ROOT, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, serialized, "utf8");
  }
  console.log(
    `Generated web-pack.json -> ${OUTPUT_TARGETS.join(", ")} (version=${capsule.version}, size=${byteLength} B, sha256=${sha256})`,
  );
}

main();
