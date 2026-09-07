#!/usr/bin/env node
/**
 * 从 data/bible/sqlite/*.sqlite 生成按卷切分的静态经文 JSON：
 *
 *   public/scripture/{translationId}/{BOOK}.json
 *
 *   npm run build:static-scripture           # 增量：sqlite 更新过的译本才重生成
 *   npm run build:static-scripture -- --force
 *
 * 为什么要它：读经主路径目前每次请求都把整个 5-6MB sqlite 读进内存交给 sql.js 查。
 * 那是为常驻 Node 进程设计的，换到边缘运行时（Workers isolate 生命周期短、无 fs）
 * 就站不住。切成按卷静态文件后，读一章只取约 100KB，可被 CDN 全缓存，且不依赖 fs。
 *
 * 产物不入库（.gitignore），由 prebuild 生成——sqlite 本身已入库且是 App 打包的来源
 * （scripts/sync-mobile-scripture-sqlite.mjs），再把 JSON 也提交进去就是同一份数据存两遍。
 *
 * 需用 scripts/tsconfig.config-build.json 跑（server-only stub）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getScriptureDatabase, scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import { readBibleTranslationRegistry } from "@/lib/bible/providers/registry";
import {
  STATIC_SCRIPTURE_DIR_REL,
  staticScriptureBookRelPath,
  type StaticScriptureBookFile,
  type StaticScriptureVerse,
} from "@/lib/bible/static-scripture-shape";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(repoRoot, STATIC_SCRIPTURE_DIR_REL);
const force = process.argv.includes("--force");

type VerseRow = {
  book_id: string;
  chapter: number;
  verse: number;
  text: string;
  speech_spans?: string | null;
  theme_repeat_count?: number | null;
};

function buildBookPayload(rows: VerseRow[]): StaticScriptureBookFile {
  const chapters: StaticScriptureBookFile["c"] = {};
  for (const r of rows) {
    const key = String(r.chapter);
    if (!chapters[key]) chapters[key] = [];
    const spans = (r.speech_spans ?? "").trim();
    const repeat = Math.max(0, Number(r.theme_repeat_count ?? 0));
    const verse: StaticScriptureVerse =
      spans || repeat > 0
        ? { t: r.text, ...(spans ? { s: spans } : {}), ...(repeat > 0 ? { r: repeat } : {}) }
        : r.text;
    chapters[key][r.verse - 1] = verse;
  }
  return { v: 1, c: chapters };
}

/** sqlite 比该译本已生成的产物新时才重跑；`--force` 跳过此判断。 */
function needsRebuild(tid: string, sqlitePath: string): boolean {
  if (force) return true;
  const dir = path.join(outRoot, tid);
  if (!fs.existsSync(dir)) return true;
  const names = fs.readdirSync(dir).filter((n) => n.endsWith(".json"));
  if (names.length === 0) return true;
  const srcMs = fs.statSync(sqlitePath).mtimeMs;
  const oldestOut = Math.min(...names.map((n) => fs.statSync(path.join(dir, n)).mtimeMs));
  return srcMs > oldestOut;
}

async function buildTranslation(tid: string): Promise<{ books: number; bytes: number }> {
  const db = await getScriptureDatabase(repoRoot, tid);
  if (!db) throw new Error(`打不开译本数据库：${tid}`);

  const stmt = db.prepare(
    "SELECT book_id, chapter, verse, text, speech_spans, theme_repeat_count FROM verse ORDER BY book_id, chapter, verse",
  );
  const byBook = new Map<string, VerseRow[]>();
  while (stmt.step()) {
    const r = stmt.getAsObject() as unknown as VerseRow;
    if (!byBook.has(r.book_id)) byBook.set(r.book_id, []);
    byBook.get(r.book_id)!.push(r);
  }
  stmt.free();

  /** 整份重写，避免译本删卷后留下孤儿文件被当成有效数据。 */
  const dir = path.join(outRoot, tid);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  let bytes = 0;
  for (const [bookId, rows] of byBook) {
    const body = JSON.stringify(buildBookPayload(rows));
    fs.writeFileSync(path.join(repoRoot, staticScriptureBookRelPath(tid, bookId)), body, "utf8");
    bytes += Buffer.byteLength(body);
  }
  return { books: byBook.size, bytes };
}

async function main(): Promise<void> {
  const index = readBibleTranslationRegistry(repoRoot);
  const local = index.translations.filter((t) => !t.provider || t.provider === "local");
  fs.mkdirSync(outRoot, { recursive: true });

  let totalBooks = 0;
  let totalBytes = 0;
  let skipped = 0;

  for (const t of local) {
    const sqlitePath = scriptureSqlitePath(repoRoot, t.id);
    if (!fs.existsSync(sqlitePath)) continue;
    if (!needsRebuild(t.id, sqlitePath)) {
      skipped += 1;
      continue;
    }
    const { books, bytes } = await buildTranslation(t.id);
    totalBooks += books;
    totalBytes += bytes;
    console.log(`  ${(bytes / 1048576).toFixed(1).padStart(6)} MB  ${String(books).padStart(3)} 卷  ${t.id}`);
  }

  if (skipped > 0) console.log(`  （${skipped} 个译本的 sqlite 未变动，跳过）`);
  console.log(
    `静态经文：${totalBooks} 个文件，${(totalBytes / 1048576).toFixed(1)} MB → ${STATIC_SCRIPTURE_DIR_REL}/`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
