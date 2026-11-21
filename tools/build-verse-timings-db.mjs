#!/usr/bin/env node
/**
 * 从真源 `public/verse-timings/`（cuv-v20 / cuv-simp 根级 / web-en）直接生成原生侧 SQLite（D-44 全端同源，不再经由已退役的 RN bundle JSON）。
 *
 *   npm run build:verse-timings
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT, "public/verse-timings");
const OUT = path.join(ROOT, "apps/askbible-ios/AskBible/Resources/verse-timings.sqlite");
const OUT_ANDROID = path.join(ROOT, "apps/askbible-android/app/src/main/assets/verse-timings.sqlite");
const SCOPES = [
  ["cuv-v20", path.join(SRC_DIR, "cuv-v20")],
  ["cuv-simp", SRC_DIR],
  ["web-en", path.join(SRC_DIR, "web-en")],
];

const rows = [];
for (const [scope, dir] of SCOPES) {
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const key = file.slice(0, -5);
    const cut = key.lastIndexOf("-");
    if (cut < 1) continue;
    const bookId = key.slice(0, cut).toUpperCase();
    const chapter = Number(key.slice(cut + 1));
    if (!Number.isInteger(chapter) || chapter < 1) continue;
    const list = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    if (!Array.isArray(list)) continue;
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

mkdirSync(path.dirname(OUT), { recursive: true });
mkdirSync(path.dirname(OUT_ANDROID), { recursive: true });
if (existsSync(OUT)) unlinkSync(OUT);

const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
const scopeNames = SCOPES.map(([s]) => s);
const sqlPath = path.join(ROOT, "tmp-timings.sql");
const chunks = [
  "PRAGMA journal_mode=OFF;",
  "BEGIN;",
  `CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
  `INSERT INTO meta VALUES ('format','askbible-verse-timings-v1');`,
  `INSERT INTO meta VALUES ('source','public/verse-timings');`,
  `INSERT INTO meta VALUES ('scopes',${esc(scopeNames.join(","))});`,
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
copyFileSync(OUT, OUT_ANDROID);

const size = (statSync(OUT).size / 1024 / 1024).toFixed(1);
const perScope = scopeNames.map((s) => `${s} ${rows.filter((r) => r[0] === s).length}`).join(" · ");
console.log(`verse-timings.sqlite 生成：${rows.length} 条（${perScope}），${size} MB`);
