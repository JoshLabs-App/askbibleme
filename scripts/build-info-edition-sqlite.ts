#!/usr/bin/env node
/**
 * 把 data/bible/info-edition-v1-published.json（22.5MB / 4761 章）转成 SQLite，
 * 供 App 按章查询：
 *
 *   npm run build:info-edition-sqlite
 *   → data/bible/sqlite/info-edition.sqlite
 *   → 再由 scripts/sync-mobile-info-edition-sqlite.mjs 同步进 App assets
 *
 * 为什么：App 端 `src/bible/bundled-info-edition.ts` 在模块顶层 require 整份 JSON，
 * 一进读经页就同步 JSON.parse 22.5MB——Hermes 上实测 34ms（手机慢 3-5 倍），
 * 且解析后常驻约 27MB。为显示一章而把全本 4761 章驻留内存，代价不合理。
 * 换成 SQLite 后按 key 精确查，内存几乎为零，也不再阻塞 JS 线程。
 *
 * 表结构刻意保留原始 key（`BOOK:章` 或 `BOOK:章:roleId`），让 App 的查找逻辑
 * 一行不改地平移过来，只把「对象取下标」换成「按 key 查一行」。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSqlJsStatic } from "@/lib/bible/sql-js-wasm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(repoRoot, "data", "bible", "info-edition-v1-published.json");
const outPath = path.join(repoRoot, "data", "bible", "sqlite", "info-edition.sqlite");

export const INFO_EDITION_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS chapter (
  key TEXT PRIMARY KEY NOT NULL,
  book_id TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  role_id TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chapter_book ON chapter(book_id, chapter);
`;

type PublishedChapter = {
  bookId?: string;
  chapter?: number;
  roleId?: string;
  markdown?: string;
};

async function main(): Promise<void> {
  if (!fs.existsSync(srcPath)) throw new Error(`找不到真源：${path.relative(repoRoot, srcPath)}`);

  const raw = fs.readFileSync(srcPath, "utf8");
  const parsed = JSON.parse(raw) as { chapters?: Record<string, PublishedChapter> };
  const chapters = parsed.chapters ?? {};
  const keys = Object.keys(chapters);
  if (keys.length === 0) throw new Error("真源里没有 chapters");

  const SQL = await getSqlJsStatic(repoRoot);
  const db = new SQL.Database();
  db.run("PRAGMA journal_mode = OFF;");
  db.run(INFO_EDITION_SQLITE_SCHEMA);
  db.run("BEGIN TRANSACTION;");

  const stmt = db.prepare(
    "INSERT OR REPLACE INTO chapter (key, book_id, chapter, role_id, payload) VALUES (?, ?, ?, ?, ?)",
  );
  let written = 0;
  let skipped = 0;
  for (const key of keys) {
    const value = chapters[key];
    /** 没有正文的条目对读者没有意义，跳过可省下体积。 */
    if (!value?.markdown?.trim()) {
      skipped += 1;
      continue;
    }
    /** key 的前两段就是书卷与章；roleId 缺省为空串，与 App 的 legacy key 对齐。 */
    const [bookFromKey, chapterFromKey] = key.split(":");
    stmt.run([
      key,
      String(value.bookId ?? bookFromKey ?? "").toUpperCase(),
      Number(value.chapter ?? Number(chapterFromKey) ?? 0),
      String(value.roleId ?? ""),
      JSON.stringify(value),
    ]);
    written += 1;
  }
  stmt.free();
  db.run("COMMIT;");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(db.export()));
  db.close();

  const srcMb = fs.statSync(srcPath).size / 1048576;
  const outMb = fs.statSync(outPath).size / 1048576;
  console.log(
    `info-edition sqlite：${written} 章（跳过无正文 ${skipped}），` +
      `${srcMb.toFixed(1)} MB JSON → ${outMb.toFixed(1)} MB sqlite`,
  );
  console.log(`  → ${path.relative(repoRoot, outPath)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
