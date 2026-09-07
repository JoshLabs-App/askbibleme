#!/usr/bin/env node
/**
 * 逐章比对静态交叉引用产物与 sqlite 真源。
 *
 *   npm run verify:static-xrefs
 *
 * 读经页每章都要取 xref，出错等于关联经文显示错，值得全量校一遍（只有 1189 章，很快）。
 * 比对整个 JSON 结构：节序、incoming/outgoing 的条目与顺序、priority 全部要一致。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getScriptureXrefDatabase } from "@/lib/bible/scripture-xref-db";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "@/lib/bible/scripture-xref-types";
import { staticXrefsBookRelPath, type StaticXrefsBookFile } from "@/lib/bible/static-xrefs-shape";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function target(
  bookId: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
  priority: number,
): ScriptureXrefTarget {
  return {
    bookId,
    chapter,
    verseStart,
    verseEnd: verseEnd >= verseStart ? verseEnd : verseStart,
    priority,
  };
}

/** 与 lib/bible/load-chapter-xrefs.ts 的 sqlite 分支同构，用作独立真源。 */
async function fromSqlite(bookId: string, chapter: number): Promise<ScriptureVerseXrefs[] | null> {
  const db = await getScriptureXrefDatabase(repoRoot);
  if (!db) return null;
  const byVerse = new Map<number, ScriptureVerseXrefs>();

  const out = db.prepare(
    `SELECT from_verse, to_book_id, to_chapter, to_verse_start, to_verse_end, priority
     FROM xref_out WHERE from_book_id = ? AND from_chapter = ? ORDER BY from_verse, priority DESC`,
  );
  out.bind([bookId, chapter]);
  while (out.step()) {
    const r = out.getAsObject() as Record<string, unknown>;
    const v = Number(r.from_verse);
    let b = byVerse.get(v);
    if (!b) { b = { verse: v, incoming: [], outgoing: [] }; byVerse.set(v, b); }
    b.outgoing.push(
      target(String(r.to_book_id), Number(r.to_chapter), Number(r.to_verse_start), Number(r.to_verse_end), Number(r.priority)),
    );
  }
  out.free();

  const inc = db.prepare(
    `SELECT to_verse, from_book_id, from_chapter, from_verse, priority
     FROM xref_in WHERE to_book_id = ? AND to_chapter = ? ORDER BY to_verse, priority DESC`,
  );
  inc.bind([bookId, chapter]);
  while (inc.step()) {
    const r = inc.getAsObject() as Record<string, unknown>;
    const v = Number(r.to_verse);
    const fv = Number(r.from_verse);
    let b = byVerse.get(v);
    if (!b) { b = { verse: v, incoming: [], outgoing: [] }; byVerse.set(v, b); }
    b.incoming.push(target(String(r.from_book_id), Number(r.from_chapter), fv, fv, Number(r.priority)));
  }
  inc.free();

  return [...byVerse.values()].sort((a, b) => a.verse - b.verse);
}

async function main(): Promise<void> {
  let checked = 0;
  let withXrefs = 0;
  const problems: string[] = [];

  for (const book of scriptureBooks) {
    const abs = path.join(repoRoot, staticXrefsBookRelPath(book.bookId));
    const file: StaticXrefsBookFile | null = fs.existsSync(abs)
      ? (JSON.parse(fs.readFileSync(abs, "utf8")) as StaticXrefsBookFile)
      : null;

    for (let ch = 1; ch <= book.chapters; ch += 1) {
      const sql = (await fromSqlite(book.bookId, ch)) ?? [];
      const stat = file?.c[String(ch)] ?? [];
      checked += 1;
      if (sql.length > 0) withXrefs += 1;
      if (JSON.stringify(sql) !== JSON.stringify(stat)) {
        problems.push(`${book.bookId}:${ch} sqlite=${sql.length} static=${stat.length}`);
        if (problems.length > 20) break;
      }
    }
    if (problems.length > 20) break;
  }

  console.log(`比对 ${checked} 章（其中 ${withXrefs} 章有 xref）`);
  if (problems.length === 0) {
    console.log("  结果  全部一致 ✓");
    return;
  }
  console.error(`\n发现 ${problems.length} 处不一致：`);
  for (const p of problems.slice(0, 20)) console.error(`  ${p}`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
