#!/usr/bin/env node
/**
 * 评估「经文按卷静态化」的产出规模：文件数、总体积、单文件最大值，
 * 用来判断是否落在 Cloudflare Pages 的限制内（单文件 25MB、总文件数 2 万）。
 *
 *   npx tsx --tsconfig scripts/tsconfig.config-build.json scripts/estimate-static-scripture.ts
 *
 * 只评估，不写文件。真正的生成脚本等方案定了再写。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getScriptureDatabase, scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import { readBibleTranslationRegistry } from "@/lib/bible/providers/registry";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type BookStat = { bookId: string; chapters: number; verses: number; jsonBytes: number };

type VerseRow = {
  book_id: string;
  chapter: number;
  verse: number;
  text: string;
  speech_spans?: string | null;
  theme_repeat_count?: number | null;
};

/**
 * 按卷一个文件，章号为键。节的形态取决于有没有额外标注——读经页要的不只是正文：
 * `speech_spans` 决定朗读分色，`theme_repeat_count` 决定金句色带
 * （见 lib/bible/loaded-chapter-verse.ts）。多数节两者皆无，退化成纯字符串，
 * 有标注的才用对象，避免为少数节让整份文件都背上键名。
 */
function buildBookPayload(rows: VerseRow[]): Record<string, (string | Record<string, unknown>)[]> {
  const byChapter: Record<string, (string | Record<string, unknown>)[]> = {};
  for (const r of rows) {
    const key = String(r.chapter);
    if (!byChapter[key]) byChapter[key] = [];
    const spans = (r.speech_spans ?? "").trim();
    const repeat = Math.max(0, Number(r.theme_repeat_count ?? 0));
    byChapter[key][r.verse - 1] =
      spans || repeat > 0
        ? { t: r.text, ...(spans ? { s: spans } : {}), ...(repeat > 0 ? { r: repeat } : {}) }
        : r.text;
  }
  return byChapter;
}

async function statTranslation(tid: string): Promise<{ books: BookStat[]; totalBytes: number } | null> {
  const db = await getScriptureDatabase(repoRoot, tid);
  if (!db) return null;

  const stmt = db.prepare("SELECT book_id, chapter, verse, text, speech_spans, theme_repeat_count FROM verse ORDER BY book_id, chapter, verse");
  const byBook = new Map<string, VerseRow[]>();
  while (stmt.step()) {
    const r = stmt.getAsObject() as unknown as VerseRow;
    if (!byBook.has(r.book_id)) byBook.set(r.book_id, []);
    byBook.get(r.book_id)!.push(r);
  }
  stmt.free();

  const books: BookStat[] = [];
  let totalBytes = 0;
  for (const [bookId, rows] of byBook) {
    const payload = buildBookPayload(rows);
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    totalBytes += bytes;
    books.push({
      bookId,
      chapters: Object.keys(payload).length,
      verses: rows.length,
      jsonBytes: bytes,
    });
  }
  return { books, totalBytes };
}

async function main(): Promise<void> {
  const index = readBibleTranslationRegistry(repoRoot);
  const local = index.translations.filter((t) => !t.provider || t.provider === "local");

  console.log(`本地译本 ${local.length} 个（远程 provider 不参与静态化，仍需服务端）\n`);

  let grandBytes = 0;
  let grandFiles = 0;
  let maxFile = { name: "", bytes: 0 };
  const perTranslation: { id: string; files: number; bytes: number }[] = [];

  for (const t of local) {
    const sqlitePath = scriptureSqlitePath(repoRoot, t.id);
    if (!fs.existsSync(sqlitePath)) {
      console.log(`  跳过 ${t.id}（无 sqlite）`);
      continue;
    }
    const stat = await statTranslation(t.id);
    if (!stat) {
      console.log(`  跳过 ${t.id}（打不开）`);
      continue;
    }
    for (const b of stat.books) {
      if (b.jsonBytes > maxFile.bytes) maxFile = { name: `${t.id}/${b.bookId}`, bytes: b.jsonBytes };
    }
    grandBytes += stat.totalBytes;
    grandFiles += stat.books.length;
    perTranslation.push({ id: t.id, files: stat.books.length, bytes: stat.totalBytes });
  }

  perTranslation.sort((a, b) => b.bytes - a.bytes);
  for (const p of perTranslation) {
    console.log(`  ${(p.bytes / 1048576).toFixed(1).padStart(6)} MB  ${String(p.files).padStart(3)} 卷  ${p.id}`);
  }

  const sqliteTotal = perTranslation.reduce((sum, p) => {
    const f = scriptureSqlitePath(repoRoot, p.id);
    return sum + (fs.existsSync(f) ? fs.statSync(f).size : 0);
  }, 0);

  console.log("\n合计：");
  console.log(`  文件数        ${grandFiles}（Pages 上限 20000 → ${grandFiles < 20000 ? "通过" : "超限"}）`);
  console.log(`  总体积        ${(grandBytes / 1048576).toFixed(1)} MB（当前 sqlite ${(sqliteTotal / 1048576).toFixed(1)} MB）`);
  console.log(`  单文件最大    ${(maxFile.bytes / 1048576).toFixed(2)} MB — ${maxFile.name}（Pages 上限 25MB → ${maxFile.bytes < 26214400 ? "通过" : "超限"}）`);
  console.log(`\n  加上现有 public/ 90MB ≈ ${((grandBytes + 94371840) / 1048576).toFixed(0)} MB`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
