#!/usr/bin/env node
/**
 * Local picker: multi-select verses to KEEP; unselected flagged verses are removed
 * from allowlist + golden-verse audio, then pool is rebuilt.
 *
 *   node scripts/verse-pool-picker-server.mjs
 *   open http://127.0.0.1:3751
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildAuditItems,
  CATEGORY_META,
  defaultKeepSet,
  parseAllowlistTsv,
  verseKeyToAudioFilenames,
} from "./lib/verse-pool-audit-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.VERSE_POOL_PICKER_PORT || 3751);
const scopeId = "theme-repeat-ge5";
const allowlistPath = path.join(repoRoot, "data/scripture", `${scopeId}-allowlist.tsv`);
const keepStatePath = path.join(repoRoot, "data/scripture/verse-pool-review-keep.json");
const audioRoot = path.join(repoRoot, "public/audio");

function readItems() {
  const rows = parseAllowlistTsv(fs.readFileSync(allowlistPath, "utf8"));
  return buildAuditItems(rows);
}

function readKeepState() {
  if (!fs.existsSync(keepStatePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(keepStatePath, "utf8"));
    if (!Array.isArray(data.keep)) return null;
    return new Set(data.keep.map((k) => String(k).trim().toUpperCase()).filter(Boolean));
  } catch {
    return null;
  }
}

function writeKeepState(keep) {
  fs.mkdirSync(path.dirname(keepStatePath), { recursive: true });
  fs.writeFileSync(
    keepStatePath,
    `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), keep: [...keep].sort() }, null, 2)}\n`,
    "utf8",
  );
}

function applyRemovals(keepSet) {
  const items = readItems();
  const flagged = new Set(items.map((i) => i.verseKey));
  const toRemove = [...flagged].filter((k) => !keepSet.has(k));

  const raw = fs.readFileSync(allowlistPath, "utf8");
  const header = [];
  const keptRows = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("#")) {
      header.push(line);
      continue;
    }
    const verseKey = line.split("\t")[0]?.trim().toUpperCase() ?? "";
    if (!verseKey || toRemove.includes(verseKey)) continue;
    keptRows.push(line);
  }

  const backupPath = `${allowlistPath}.bak-${Date.now()}`;
  fs.copyFileSync(allowlistPath, backupPath);

  fs.writeFileSync(allowlistPath, `${[...header, ...keptRows].join("\n")}\n`, "utf8");

  const audioDeleted = [];
  const audioMissing = [];
  for (const verseKey of toRemove) {
    for (const rel of verseKeyToAudioFilenames(verseKey)) {
      const abs = path.join(audioRoot, rel);
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
        audioDeleted.push(rel);
      } else {
        audioMissing.push(rel);
      }
    }
  }

  writeKeepState(keepSet);

  let rebuildLog = "";
  const syncSteps = [
    "node scripts/prune-theme-repeat-pool-from-allowlist.mjs",
    "node scripts/generate-home-verse-pool-menu-counts.mjs",
    "node scripts/sync-mobile-home-verse-pool.mjs",
    "node scripts/generate-mobile-home-verse-chunk-registry.mjs",
  ];
  for (const cmd of syncSteps) {
    try {
      rebuildLog += execSync(cmd, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      rebuildLog += String(e.stdout || "") + String(e.stderr || "") + String(e.message || e);
    }
  }

  return {
    removedCount: toRemove.length,
    removed: toRemove,
    allowlistBefore: flagged.size,
    allowlistAfterRows: keptRows.length,
    audioDeleted: audioDeleted.length,
    audioMissing: audioMissing.length,
    backupPath,
    rebuildLog: rebuildLog.trim(),
  };
}

function renderHtml(items, initialKeep) {
  const payload = JSON.stringify({ items, categories: CATEGORY_META, initialKeep: [...initialKeep] });
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>金句池审查 · 选择保留</title>
  <style>
    :root { --bg:#f7f4ef; --paper:#fffdf9; --ink:#1f1a14; --muted:#6b6258; --line:#e7dfd3; --danger:#b42318; --ok:#027a48; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Songti SC","Noto Serif SC",Georgia,serif; background:var(--bg); color:var(--ink); }
    .wrap { max-width:1100px; margin:0 auto; padding:20px 16px 120px; }
    .hero { background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:20px; margin-bottom:16px; }
    .hero h1 { margin:0 0 8px; font-size:1.5rem; }
    .hero p { margin:0; color:var(--muted); line-height:1.6; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin:16px 0; align-items:center; }
    input[type=search] { flex:1 1 200px; border:1px solid var(--line); border-radius:999px; padding:10px 14px; font:inherit; background:var(--paper); }
    .cat-tabs { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
    .cat-tabs button { border:1px solid var(--line); background:var(--paper); border-radius:999px; padding:6px 12px; cursor:pointer; font:inherit; }
    .cat-tabs button.active { background:#efe8dc; border-color:#c8b9a4; }
    .list { display:flex; flex-direction:column; gap:10px; }
    .item {
      display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:start;
      background:var(--paper); border:1px solid var(--line); border-radius:14px; padding:12px 14px;
    }
    .item.off { opacity:.55; }
    .item h3 { margin:0 0 4px; font-size:1rem; }
    .meta { color:var(--muted); font-size:.85rem; display:flex; flex-wrap:wrap; gap:8px; margin-bottom:6px; }
    .tag { background:#efe8dc; border-radius:999px; padding:1px 8px; font-size:.78rem; }
    .text { margin:0; line-height:1.65; }
    .pair { margin-top:6px; padding-top:6px; border-top:1px dashed var(--line); color:var(--muted); font-size:.92rem; }
    .bar {
      position:fixed; left:0; right:0; bottom:0; z-index:20;
      background:rgba(255,253,249,.95); backdrop-filter:blur(8px);
      border-top:1px solid var(--line); padding:12px 16px;
      display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;
    }
    .stats strong { font-size:1.1rem; }
    .stats span { color:var(--muted); margin-left:8px; }
    .actions { display:flex; gap:10px; flex-wrap:wrap; }
    button.primary { background:var(--ok); color:#fff; border:none; border-radius:999px; padding:10px 18px; font:inherit; cursor:pointer; }
    button.secondary { background:var(--paper); border:1px solid var(--line); border-radius:999px; padding:10px 14px; font:inherit; cursor:pointer; }
    button.danger { background:var(--danger); color:#fff; border:none; border-radius:999px; padding:10px 18px; font:inherit; cursor:pointer; }
    #toast { position:fixed; top:16px; right:16px; max-width:360px; background:#1f1a14; color:#fff; padding:12px 14px; border-radius:12px; display:none; white-space:pre-wrap; font-size:.9rem; z-index:30; }
    .hidden { display:none !important; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>金句池审查 · 选择要保留的经文</h1>
      <p>勾选 = <strong>保留</strong>；未勾选 = 保存时从 allowlist 删除，并删除中英文金句语音（<code>public/audio/golden-verses*</code>），然后重建池子。</p>
      <p>共 <strong id="totalCount">0</strong> 条待审查。未在列表中的 ~4000 节不受影响。</p>
    </header>
    <div class="toolbar">
      <input id="q" type="search" placeholder="搜索书卷、经文、内容…" />
      <button class="secondary" id="allKeep">全选保留</button>
      <button class="secondary" id="noneKeep">全不保留</button>
      <button class="secondary" id="defaultKeep">恢复推荐默认</button>
    </div>
    <div class="cat-tabs" id="catTabs"></div>
    <div class="list" id="list"></div>
  </div>
  <div class="bar">
    <div class="stats">
      <strong id="keepCount">0</strong><span>保留</span>
      <strong id="removeCount" style="color:var(--danger);margin-left:16px;">0</strong><span>将删除</span>
    </div>
    <div class="actions">
      <button class="secondary" id="saveOnly">仅保存选择</button>
      <button class="danger" id="apply">保存并删除未选项</button>
    </div>
  </div>
  <div id="toast"></div>
  <script>
    const DATA = ${payload};
    const keep = new Set(DATA.initialKeep);
    let activeCat = "all";

    const listEl = document.getElementById("list");
    const catTabs = document.getElementById("catTabs");
    document.getElementById("totalCount").textContent = DATA.items.length;

    function catsLabel(item) {
      return item.categories.map(c => DATA.categories[c]?.label || c).join(" · ");
    }

    function renderTabs() {
      const cats = ["all", ...Object.keys(DATA.categories)];
      catTabs.innerHTML = cats.map(c => {
        const label = c === "all" ? "全部" : DATA.categories[c].label;
        const n = c === "all" ? DATA.items.length : DATA.items.filter(i => i.categories.includes(c)).length;
        return '<button class="' + (activeCat===c?'active':'') + '" data-cat="' + c + '">' + label + ' (' + n + ')</button>';
      }).join("");
      catTabs.querySelectorAll("button").forEach(btn => btn.onclick = () => {
        activeCat = btn.dataset.cat;
        renderTabs();
        renderList();
      });
    }

    function renderList() {
      const term = document.getElementById("q").value.trim().toLowerCase();
      listEl.innerHTML = "";
      for (const item of DATA.items) {
        if (activeCat !== "all" && !item.categories.includes(activeCat)) continue;
        const hay = (item.reference + " " + item.text + " " + item.verseKey).toLowerCase();
        if (term && !hay.includes(term)) continue;
        const checked = keep.has(item.verseKey);
        const el = document.createElement("div");
        el.className = "item" + (checked ? "" : " off");
        el.innerHTML =
          '<label><input type="checkbox" ' + (checked ? "checked" : "") + ' data-key="' + item.verseKey + '"></label>' +
          '<div><h3>' + item.reference + ' <span style="color:#6b6258;font-weight:normal;">×' + item.repeatCount + '</span></h3>' +
          '<div class="meta"><code>' + item.verseKey + '</code>' + item.categories.map(c => '<span class="tag">' + (DATA.categories[c]?.label||c) + '</span>').join('') + '</div>' +
          '<p class="text">' + item.text + '</p>' +
          (item.pairReference ? '<p class="pair">配对：' + item.pairReference + ' — ' + (item.pairText||'') + '</p>' : '') +
          '</div>';
        const cb = el.querySelector("input");
        cb.onchange = () => {
          if (cb.checked) keep.add(item.verseKey); else keep.delete(item.verseKey);
          el.classList.toggle("off", !cb.checked);
          updateStats();
        };
        listEl.appendChild(el);
      }
      updateStats();
    }

    function updateStats() {
      document.getElementById("keepCount").textContent = keep.size;
      document.getElementById("removeCount").textContent = DATA.items.length - keep.size;
    }

    function toast(msg, ms=5000) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.style.display = "block";
      clearTimeout(t._timer);
      t._timer = setTimeout(() => { t.style.display = "none"; }, ms);
    }

    async function post(path, body) {
      const res = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "请求失败");
      return json;
    }

    document.getElementById("allKeep").onclick = () => { DATA.items.forEach(i => keep.add(i.verseKey)); renderList(); };
    document.getElementById("noneKeep").onclick = () => { keep.clear(); renderList(); };
    document.getElementById("defaultKeep").onclick = () => {
      keep.clear();
      for (const i of DATA.items) {
        if (i.categories.some(c => DATA.categories[c]?.defaultKeep)) keep.add(i.verseKey);
      }
      renderList();
    };
    document.getElementById("q").oninput = renderList;

    document.getElementById("saveOnly").onclick = async () => {
      try {
        await post("/api/save", { keep: [...keep] });
        toast("已保存选择（未删除）");
      } catch (e) { toast(String(e.message)); }
    };

    document.getElementById("apply").onclick = async () => {
      const n = DATA.items.length - keep.size;
      if (!confirm("确定删除 " + n + " 条未勾选的经文？\\n\\n将更新 allowlist、删除本地语音并重建池子。此操作可回滚 allowlist 备份。")) return;
      try {
        const res = await post("/api/apply", { keep: [...keep] });
        toast("完成：删除 " + res.removedCount + " 条，语音 " + res.audioDeleted + " 个\\n备份：" + res.backupPath, 12000);
      } catch (e) { toast(String(e.message)); }
    };

    renderTabs();
    renderList();
  </script>
</body>
</html>`;
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      const items = readItems();
      const saved = readKeepState();
      const initialKeep = saved ?? defaultKeepSet(items);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderHtml(items, initialKeep));
      return;
    }

    if (req.method === "POST" && (req.url === "/api/save" || req.url === "/api/apply")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const keep = new Set(
        (Array.isArray(body.keep) ? body.keep : [])
          .map((k) => String(k).trim().toUpperCase())
          .filter(Boolean),
      );
      if (req.url === "/api/save") {
        writeKeepState(keep);
        sendJson(res, 200, { ok: true, keepCount: keep.size });
        return;
      }
      const result = applyRemovals(keep);
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Verse pool picker: http://127.0.0.1:${port}`);
  console.log("勾选保留 →「保存并删除未选项」");
});
