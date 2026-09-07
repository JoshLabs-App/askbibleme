#!/usr/bin/env node
/**
 * 逐节比对静态经文产物与 sqlite 真源，确保切分过程没有丢节、错位或改字。
 *
 *   npm run verify:static-scripture              # 每个译本抽samples 章
 *   npm run verify:static-scripture -- --full    # 全量 1189 章 × 每个译本（慢）
 *
 * 检查项：节数、节号、正文、speech_spans、theme_repeat_count 全部一致。
 * 静态化动的是读经主路径，出错等于经文显示错，必须逐字校。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getScriptureDatabase, scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import { readBibleTranslationRegistry } from "@/lib/bible/providers/registry";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import {
  staticScriptureBookRelPath,
  type StaticScriptureBookFile,
  type StaticScriptureVerse,
} from "@/lib/bible/static-scripture-shape";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
const SAMPLES_PER_TRANSLATION = 40;

type Norm = { verse: number; text: string; spans: string; repeat: number };

function normalizeStatic(entry: StaticScriptureVerse, index: number): Norm {
  return typeof entry === "string"
    ? { verse: index + 1, text: entry, spans: "", repeat: 0 }
    : { verse: index + 1, text: entry.t, spans: entry.s ?? "", repeat: entry.r ?? 0 };
}

function pickChapters(): { bookId: string; chapter: number }[] {
  const all: { bookId: string; chapter: number }[] = [];
  for (const b of scriptureBooks) {
    for (let c = 1; c <= b.chapters; c += 1) all.push({ bookId: b.bookId, chapter: c });
  }
  if (full) return all;
  /** 固定步长取样：覆盖全书且每次运行结果可复现，便于对照上次输出。 */
  const step = Math.max(1, Math.floor(all.length / SAMPLES_PER_TRANSLATION));
  return all.filter((_, i) => i % step === 0).slice(0, SAMPLES_PER_TRANSLATION);
}

async function main(): Promise<void> {
  const index = readBibleTranslationRegistry(repoRoot);
  const local = index.translations.filter((t) => !t.provider || t.provider === "local");
  const targets = pickChapters();

  let checkedChapters = 0;
  let checkedVerses = 0;
  const problems: string[] = [];

  for (const t of local) {
    const sqlitePath = scriptureSqlitePath(repoRoot, t.id);
    if (!fs.existsSync(sqlitePath)) continue;
    const db = await getScriptureDatabase(repoRoot, t.id);
    if (!db) {
      problems.push(`${t.id}: sqlite 打不开`);
      continue;
    }

    const bookCache = new Map<string, StaticScriptureBookFile | null>();
    const stmt = db.prepare(
      "SELECT verse, text, speech_spans, theme_repeat_count FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC",
    );

    for (const { bookId, chapter } of targets) {
      if (!bookCache.has(bookId)) {
        const abs = path.join(repoRoot, staticScriptureBookRelPath(t.id, bookId));
        bookCache.set(
          bookId,
          fs.existsSync(abs) ? (JSON.parse(fs.readFileSync(abs, "utf8")) as StaticScriptureBookFile) : null,
        );
      }
      const file = bookCache.get(bookId) ?? null;

      const fromSql: Norm[] = [];
      stmt.bind([bookId, chapter]);
      while (stmt.step()) {
        const r = stmt.getAsObject() as Record<string, unknown>;
        fromSql.push({
          verse: Number(r.verse),
          text: String(r.text ?? ""),
          spans: String(r.speech_spans ?? ""),
          repeat: Number(r.theme_repeat_count ?? 0),
        });
      }
      stmt.reset();

      const entries = file?.c[String(chapter)] ?? [];
      const fromStatic: Norm[] = [];
      for (let i = 0; i < entries.length; i += 1) {
        const e = entries[i];
        if (e === undefined || e === null) continue;
        fromStatic.push(normalizeStatic(e, i));
      }

      if (fromSql.length === 0 && fromStatic.length === 0) continue;
      checkedChapters += 1;

      if (fromSql.length !== fromStatic.length) {
        problems.push(`${t.id} ${bookId}:${chapter} 节数不符 sqlite=${fromSql.length} static=${fromStatic.length}`);
        continue;
      }
      for (let i = 0; i < fromSql.length; i += 1) {
        const a = fromSql[i];
        const b = fromStatic[i];
        checkedVerses += 1;
        if (a.verse !== b.verse || a.text !== b.text || a.spans !== b.spans || a.repeat !== b.repeat) {
          problems.push(
            `${t.id} ${bookId}:${chapter}:${a.verse} 不一致 ` +
              `text=${a.text === b.text} spans=${a.spans === b.spans} repeat=${a.repeat === b.repeat}`,
          );
          if (problems.length > 20) break;
        }
      }
      if (problems.length > 20) break;
    }
    stmt.free();
    if (problems.length > 20) break;
  }

  console.log(`比对 ${local.length} 个译本 × ${targets.length} 章（${full ? "全量" : "抽样"}）`);
  console.log(`  校验章数  ${checkedChapters}`);
  console.log(`  校验节数  ${checkedVerses}`);
  if (problems.length === 0) {
    console.log("  结果      全部一致 ✓");
    return;
  }
  console.error(`\n发现 ${problems.length} 处问题：`);
  for (const p of problems.slice(0, 20)) console.error(`  ${p}`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
