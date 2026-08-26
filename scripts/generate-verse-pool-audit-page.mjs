#!/usr/bin/env node
/**
 * Generate a temporary local HTML page for reviewing home verse pool issues.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsvPath = path.join(repoRoot, "data/scripture/theme-repeat-ge5-allowlist.tsv");
const outPath = path.join(repoRoot, ".artifacts/verse-pool-audit.html");

const KNOWN = {
  A_imprecatory: [
    "PSA.137.9", "PSA.58.10", "EXO.22.24", "MAT.15.4", "LEV.20.10", "LEV.20.13",
    "PRO.7.22", "DEU.22.22", "EXO.21.17",
  ],
  B_gender_slavery: [
    "1PE.3.1", "COL.3.18", "EPH.5.22", "TIT.2.5", "1CO.11.3", "COL.3.22",
    "1PE.3.5", "EPH.5.24", "PRO.31.15",
  ],
  C_sexuality: [
    "1CO.6.9", "1CO.6.10", "ROM.1.26", "ROM.1.27", "LEV.18.22", "LEV.20.13",
    "SNG.1.2", "PRO.5.3", "PRO.5.4", "1TI.1.10",
  ],
  D_judgment: [
    "HEB.10.27", "MAT.10.28", "REV.21.8", "REV.22.15", "MAT.25.41", "PSA.145.20",
    "2PE.2.1", "2TH.1.9", "GAL.1.8", "GAL.1.9", "2PE.2.14", "LUK.12.5", "JHN.3.18",
    "JHN.8.44", "HOS.4.6", "ISA.66.24", "2TH.1.8",
  ],
  E_hyperbole: ["MAT.5.29", "MAT.5.30", "MAT.18.8", "MAT.18.9", "LUK.14.26"],
  F_misquoted: [
    "PRO.3.5", "PRO.3.6", "ROM.8.28", "PHP.4.13", "PSA.37.4", "MAT.6.33",
    "1CO.10.13", "JER.29.11", "GAL.6.7", "MAT.18.20", "PRO.22.6", "ISA.54.17",
    "2CH.7.14", "ECC.3.1", "MAT.21.22", "MAT.7.1", "JHN.14.13", "JHN.14.14",
    "JAS.4.3", "MAL.3.10",
  ],
  G_parable_voice: ["MAT.25.24", "MAT.25.26"],
};

const CATEGORY_META = {
  A_imprecatory: { label: "A · 暴力 / 咒诅 / 死刑意象", severity: "high", color: "#b42318" },
  B_gender_slavery: { label: "B · 性别 / 主仆权柄", severity: "high", color: "#c4320a" },
  C_sexuality: { label: "C · 性伦理 / 情诗", severity: "high", color: "#93370d" },
  D_judgment: { label: "D · 审判 / 地狱 / 咒诅", severity: "medium", color: "#7a2e0e" },
  E_hyperbole: { label: "E · 夸张修辞（易被字面误读）", severity: "medium", color: "#854d0e" },
  F_misquoted: { label: "F · 著名断章金句", severity: "low", color: "#175cd3" },
  G_parable_voice: { label: "G · 比喻角色台词", severity: "medium", color: "#5925dc" },
  H_open_list: { label: "H · 列举未完（顿号截断）", severity: "high", color: "#b54708" },
  I_short_fragment: { label: "I · 极短片段", severity: "medium", color: "#344054" },
  J_split_pairs: { label: "J · 高流量上下节拆开", severity: "medium", color: "#027a48" },
};

function parseTsv(content) {
  const rows = [];
  for (const line of content.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const p = line.split("\t");
    if (p.length < 4) continue;
    rows.push({
      verseKey: p[0].trim().toUpperCase(),
      repeatCount: Number(p[1]),
      reference: p[2].trim(),
      text: p[3].trim(),
    });
  }
  return rows;
}

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildData(rows) {
  const keys = new Set(rows.map((r) => r.verseKey));
  const byKey = new Map(rows.map((r) => [r.verseKey, r]));
  const categories = {};

  for (const [cat, verseKeys] of Object.entries(KNOWN)) {
    categories[cat] = verseKeys
      .map((k) => byKey.get(k))
      .filter(Boolean)
      .sort((a, b) => b.repeatCount - a.repeatCount);
  }

  categories.H_open_list = rows
    .filter((r) => /、$/.test(r.text.replace(/[」』"]$/, "")))
    .sort((a, b) => b.repeatCount - a.repeatCount);

  categories.I_short_fragment = rows
    .filter((r) => r.text.replace(/\s/g, "").length <= 12)
    .sort((a, b) => b.repeatCount - a.repeatCount);

  const splitPairs = [];
  for (const row of rows) {
    const m = row.verseKey.match(/^([A-Z0-9]{3})\.(\d+)\.(\d+)$/);
    if (!m) continue;
    const nextKey = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
    if (!row.text.endsWith("，") || !keys.has(nextKey) || row.repeatCount < 50) continue;
    const next = byKey.get(nextKey);
    if (!next) continue;
    splitPairs.push({ a: row, b: next });
  }
  categories.J_split_pairs = splitPairs.sort((x, y) => y.a.repeatCount - x.a.repeatCount);

  const flaggedKeys = new Set();
  for (const items of Object.values(categories)) {
    for (const item of items) {
      if (item.a) {
        flaggedKeys.add(item.a.verseKey);
        flaggedKeys.add(item.b.verseKey);
      } else {
        flaggedKeys.add(item.verseKey);
      }
    }
  }

  return { categories, total: rows.length, flaggedCount: flaggedKeys.size };
}

function renderVerseCard(row, note = "") {
  return `<article class="card" data-ref="${esc(row.reference)}" data-text="${esc(row.text)}">
    <header>
      <h3>${esc(row.reference)}</h3>
      <span class="badge">×${row.repeatCount}</span>
      <code>${esc(row.verseKey)}</code>
    </header>
    <p class="text">${esc(row.text)}</p>
    ${note ? `<p class="note">${esc(note)}</p>` : ""}
  </article>`;
}

function renderSplitPair(pair) {
  return `<article class="card pair" data-ref="${esc(pair.a.reference)}">
    <header>
      <h3>${esc(pair.a.reference)} + ${esc(pair.b.reference)}</h3>
      <span class="badge">×${pair.a.repeatCount}</span>
    </header>
    <p class="text"><strong>上：</strong>${esc(pair.a.text)}</p>
    <p class="text"><strong>下：</strong>${esc(pair.b.text)}</p>
    <p class="note">两节都在池中，随机展示时容易断章。</p>
  </article>`;
}

function renderSection(cat, items) {
  const meta = CATEGORY_META[cat];
  if (!items.length) return "";
  const cards =
    cat === "J_split_pairs"
      ? items.map(renderSplitPair).join("")
      : items.map((r) => renderVerseCard(r)).join("");
  return `<section class="section" id="${cat}" data-severity="${meta.severity}">
    <div class="section-head" style="--accent:${meta.color}">
      <h2>${esc(meta.label)}</h2>
      <span class="count">${items.length}</span>
    </div>
    <div class="grid">${cards}</div>
  </section>`;
}

function main() {
  const rows = parseTsv(fs.readFileSync(tsvPath, "utf8"));
  const { categories, total, flaggedCount } = buildData(rows);
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });

  const nav = Object.entries(CATEGORY_META)
    .map(([cat, meta]) => {
      const n = categories[cat]?.length ?? 0;
      if (!n) return "";
      return `<a href="#${cat}" style="--accent:${meta.color}">${esc(meta.label)} <em>${n}</em></a>`;
    })
    .filter(Boolean)
    .join("");

  const body = Object.keys(CATEGORY_META)
    .map((cat) => renderSection(cat, categories[cat] ?? []))
    .join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>金句池审查 · AskBible</title>
  <style>
    :root {
      --bg: #f7f4ef;
      --paper: #fffdf9;
      --ink: #1f1a14;
      --muted: #6b6258;
      --line: #e7dfd3;
      --shadow: 0 10px 30px rgba(31, 26, 20, 0.06);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Songti SC", "Noto Serif SC", Georgia, serif;
      background: linear-gradient(180deg, #efe8dc 0%, var(--bg) 180px);
      color: var(--ink);
      line-height: 1.65;
    }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 32px 20px 80px; }
    .hero {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 28px 28px 22px;
      box-shadow: var(--shadow);
      margin-bottom: 20px;
    }
    .hero h1 { margin: 0 0 8px; font-size: 1.8rem; font-weight: 600; }
    .hero p { margin: 0; color: var(--muted); }
    .stats {
      display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px;
    }
    .stat {
      background: #faf7f2; border: 1px solid var(--line); border-radius: 12px;
      padding: 10px 14px; min-width: 140px;
    }
    .stat strong { display: block; font-size: 1.35rem; }
    .stat span { color: var(--muted); font-size: 0.92rem; }
    .toolbar {
      position: sticky; top: 0; z-index: 10;
      background: rgba(247, 244, 239, 0.92);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--line);
      margin: 0 -20px 24px; padding: 12px 20px;
      display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    }
    .toolbar input {
      flex: 1 1 220px; min-width: 180px;
      border: 1px solid var(--line); border-radius: 999px;
      padding: 10px 14px; font: inherit; background: var(--paper);
    }
    .toolbar label {
      display: flex; align-items: center; gap: 6px;
      color: var(--muted); font-size: 0.92rem;
    }
    nav {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;
    }
    nav a {
      text-decoration: none; color: var(--ink);
      border: 1px solid var(--line); background: var(--paper);
      border-left: 4px solid var(--accent, #ccc);
      border-radius: 999px; padding: 6px 12px; font-size: 0.92rem;
    }
    nav a em { font-style: normal; color: var(--muted); margin-left: 4px; }
    .section { margin-bottom: 34px; }
    .section-head {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 14px; padding-bottom: 8px;
      border-bottom: 2px solid var(--accent, #ccc);
    }
    .section-head h2 { margin: 0; font-size: 1.15rem; }
    .count {
      background: var(--accent, #ccc); color: #fff;
      border-radius: 999px; padding: 2px 10px; font-size: 0.85rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 14px;
    }
    .card {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: var(--shadow);
    }
    .card header {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin-bottom: 8px;
    }
    .card h3 { margin: 0; font-size: 1rem; }
    .badge {
      background: #efe8dc; color: #5c4f3f;
      border-radius: 999px; padding: 2px 8px; font-size: 0.82rem;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.78rem; color: var(--muted);
    }
    .text { margin: 0; }
    .note {
      margin: 10px 0 0; padding-top: 8px;
      border-top: 1px dashed var(--line);
      color: var(--muted); font-size: 0.9rem;
    }
    .hidden { display: none !important; }
    footer { color: var(--muted); font-size: 0.88rem; text-align: center; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>金句池审查页（临时）</h1>
      <p>数据源：<code>data/scripture/theme-repeat-ge5-allowlist.tsv</code> · 生成于 ${esc(generatedAt)}</p>
      <div class="stats">
        <div class="stat"><strong>${total}</strong><span>池内总节数</span></div>
        <div class="stat"><strong>${flaggedCount}</strong><span>被标记的独特经文</span></div>
        <div class="stat"><strong>${categories.A_imprecatory.length}</strong><span>A 级 shock 经文</span></div>
        <div class="stat"><strong>${categories.H_open_list.length}</strong><span>顿号截断</span></div>
        <div class="stat"><strong>${categories.J_split_pairs.length}</strong><span>高流量拆开对</span></div>
      </div>
    </header>

    <div class="toolbar">
      <input id="q" type="search" placeholder="搜索书卷、经文、内容…" />
      <label><input id="highOnly" type="checkbox" /> 只看 A/B/C/H 高风险</label>
    </div>

    <nav>${nav}</nav>
    <main id="main">${body}</main>
    <footer>临时本地页，不部署。改完 allowlist 后重新运行 <code>node scripts/generate-verse-pool-audit-page.mjs</code></footer>
  </div>
  <script>
    const q = document.getElementById('q');
    const highOnly = document.getElementById('highOnly');
    const highCats = new Set(['A_imprecatory','B_gender_slavery','C_sexuality','H_open_list']);

    function applyFilter() {
      const term = q.value.trim().toLowerCase();
      document.querySelectorAll('.section').forEach((section) => {
        const cat = section.id;
        if (highOnly.checked && !highCats.has(cat)) {
          section.classList.add('hidden');
          return;
        }
        let visibleCards = 0;
        section.querySelectorAll('.card').forEach((card) => {
          const hay = (card.dataset.ref + ' ' + card.dataset.text).toLowerCase();
          const show = !term || hay.includes(term);
          card.classList.toggle('hidden', !show);
          if (show) visibleCards++;
        });
        section.classList.toggle('hidden', visibleCards === 0);
      });
    }
    q.addEventListener('input', applyFilter);
    highOnly.addEventListener('change', applyFilter);
  </script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  console.log(`Wrote ${outPath}`);
}

main();
