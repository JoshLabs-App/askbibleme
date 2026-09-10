#!/usr/bin/env node
/**
 * 把 RN 的 verse-timings-bundle.json（4.5 MB）转成原生侧用的 SQLite。
 *
 * 为什么要转：JSON 全量解析进内存代价太大，而跟读高亮只需要「当前这一章」的时间轴。
 * 转成 SQLite 后按 (scope, book, chapter) 索引查，内存占用与章大小成正比。
 *
 * 只导出 App 内置译本用得到的 scope —— kjv / teochew-nt 没进包，跳过。
 * scope 映射规则来自 `bundled-verse-timings.ts`：
 *   web-en → "web-en"；其余 cuv 系 → "cuv-v20"，缺则回退 "cuv-simp"。
 *
 *   node tools/build-verse-timings-db.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "apps/askbible-mobile/assets/content/verse-timings-bundle.json");
const OUT = path.join(ROOT, "apps/askbible-ios/AskBible/Resources/verse-timings.sqlite");
const KEEP_SCOPES = ["cuv-v20", "cuv-simp", "web-en"];

const bundle = JSON.parse(readFileSync(SRC, "utf8"));

const rows = [];
for (const scope of KEEP_SCOPES) {
  const chapters = bundle[scope];
  if (!chapters) continue;
  for (const [key, list] of Object.entries(chapters)) {
    if (!Array.isArray(list)) continue;
    // key 形如 "1CH-1"：书卷 id 自身可能含连字符以外的数字，按最后一个 '-' 切
    const cut = key.lastIndexOf("-");
    if (cut < 1) continue;
    const bookId = key.slice(0, cut).toUpperCase();
    const chapter = Number(key.slice(cut + 1));
    if (!Number.isInteger(chapter) || chapter < 1) continue;
    for (const t of list) {
      const verse = Number(t?.verse);
      const start = Number(t?.start);
      const end = Number(t?.end);
      if (!Number.isInteger(verse) || verse < 1) continue;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      rows.push([scope, bookId, chapter, verse, start, end]);
    }
  }
}

if (existsSync(OUT)) unlinkSync(OUT);

const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sqlPath = path.join(ROOT, "tmp-timings.sql");
const chunks = [
  "PRAGMA journal_mode=OFF;",
  "BEGIN;",
  `CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
  `INSERT INTO meta VALUES ('format','askbible-verse-timings-v1');`,
  `INSERT INTO meta VALUES ('source','verse-timings-bundle.json');`,
  `INSERT INTO meta VALUES ('scopes',${esc(KEEP_SCOPES.join(","))});`,
  `CREATE TABLE timing (
     scope TEXT NOT NULL, book_id TEXT NOT NULL, chapter INTEGER NOT NULL,
     verse INTEGER NOT NULL, start_sec REAL NOT NULL, end_sec REAL NOT NULL,
     PRIMARY KEY (scope, book_id, chapter, verse)
   );`,
];
for (let i = 0; i < rows.length; i += 2000) {
  const values = rows.slice(i, i + 2000)
    .map(([s, b, c, v, st, en]) => `(${esc(s)},${esc(b)},${c},${v},${st},${en})`).join(",");
  chunks.push(`INSERT INTO timing VALUES ${values};`);
}
chunks.push("CREATE INDEX idx_timing_ch ON timing(scope, book_id, chapter);");
chunks.push("COMMIT;");
chunks.push("VACUUM;");
writeFileSync(sqlPath, chunks.join("\n"));
execFileSync("sqlite3", [OUT], { input: readFileSync(sqlPath, "utf8"), stdio: ["pipe", "pipe", "inherit"] });
unlinkSync(sqlPath);

const size = (statSync(OUT).size / 1024 / 1024).toFixed(1);
const perScope = KEEP_SCOPES.map((s) => `${s} ${rows.filter((r) => r[0] === s).length}`).join(" · ");
console.log(`verse-timings.sqlite 生成：${rows.length} 条（${perScope}），${size} MB`);
