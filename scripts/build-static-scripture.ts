#!/usr/bin/env node
/**
 * 从 data/bible/sqlite/*.sqlite 生成按卷切分的静态经文 JSON：
 *
 *   public/scripture/{translationId}/{BOOK}.json
 *
 *   npm run build:static-scripture           # 增量：sqlite 与脚本指纹未变且产物完整时跳过
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
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StaticScriptureBookFile, StaticScriptureVerse } from "@/lib/bible/static-scripture-shape";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const outRoot = path.join(repoRoot, "public", "scripture");
const cachePath = path.join(repoRoot, "node_modules", ".cache", "askbible-prebuild", "build-static-scripture.json");
const force = process.argv.includes("--force") || process.env.FORCE_PREBUILD === "1";

type VerseRow = {
  book_id: string;
  chapter: number;
  verse: number;
  text: string;
  speech_spans?: string | null;
  theme_repeat_count?: number | null;
};

type CachedEntry = {
  coreFingerprint: string;
  sqliteSize: number;
  sqliteMtimeMs: number;
  sqliteSha256: string;
  bookFiles: string[];
};

type CacheFile = {
  version: 1;
  entries: Record<string, CachedEntry>;
};

function sha256File(absPath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function readCache(): CacheFile {
  if (!fs.existsSync(cachePath)) return { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Partial<CacheFile>;
    if (parsed?.version === 1 && parsed.entries && typeof parsed.entries === "object") {
      return { version: 1, entries: parsed.entries };
    }
  } catch {
    /* ignore corrupt cache */
  }
  return { version: 1, entries: {} };
}

function writeCache(cache: CacheFile): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cache)}\n`, "utf8");
}

function computeCoreFingerprint(): string {
  const hash = crypto.createHash("sha256");
  const files = [
    scriptPath,
    path.join(repoRoot, "lib/bible/scripture-sqlite-db.ts"),
    path.join(repoRoot, "lib/bible/static-scripture-shape.ts"),
    path.join(repoRoot, "lib/bible/providers/registry.ts"),
    path.join(repoRoot, "lib/bible/translations-store.ts"),
    path.join(repoRoot, "data/bible/translations.json"),
  ];
  for (const abs of files) {
    if (!fs.existsSync(abs)) {
      hash.update(`${abs}:missing\n`);
      continue;
    }
    hash.update(`${path.relative(repoRoot, abs)}:${sha256File(abs)}\n`);
  }
  return hash.digest("hex");
}

function outputDirIntact(dir: string, expectedFiles: string[]): boolean {
  if (expectedFiles.length === 0 || !fs.existsSync(dir)) return false;
  let actual: string[];
  try {
    actual = fs.readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return false;
  }
  if (actual.length !== expectedFiles.length) return false;
  const actualSet = new Set(actual);
  for (const name of expectedFiles) {
    if (!actualSet.has(name)) return false;
  }
  return true;
}

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

async function buildTranslation(
  tid: string,
  getScriptureDatabase: typeof import("@/lib/bible/scripture-sqlite-db").getScriptureDatabase,
  staticScriptureBookRelPath: typeof import("@/lib/bible/static-scripture-shape").staticScriptureBookRelPath,
): Promise<{ books: number; bytes: number; bookFiles: string[] }> {
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
  const bookFiles: string[] = [];
  for (const [bookId, rows] of byBook) {
    const body = JSON.stringify(buildBookPayload(rows));
    const rel = staticScriptureBookRelPath(tid, bookId);
    fs.writeFileSync(path.join(repoRoot, rel), body, "utf8");
    bookFiles.push(path.basename(rel));
    bytes += Buffer.byteLength(body);
  }
  return { books: byBook.size, bytes, bookFiles };
}

async function main(): Promise<void> {
  const indexAbs = path.join(repoRoot, "data", "bible", "translations.json");
  const rawIndex = fs.existsSync(indexAbs)
    ? (JSON.parse(fs.readFileSync(indexAbs, "utf8")) as { translations?: Array<{ id?: string; provider?: string }> })
    : { translations: [] };
  const local = (rawIndex.translations ?? [])
    .filter((t) => Boolean(t?.id?.trim()) && (!t.provider || t.provider === "local"))
    .map((t) => ({ id: t.id!.trim() }));

  fs.mkdirSync(outRoot, { recursive: true });

  const coreFingerprint = computeCoreFingerprint();
  const cache = readCache();
  let cacheDirty = false;

  const toBuild: Array<{ id: string; sqliteSize: number; sqliteMtimeMs: number; sqliteSha256: string }> = [];
  let skipped = 0;

  for (const t of local) {
    const sqlitePath = path.join(repoRoot, "data", "bible", "sqlite", `${t.id}.sqlite`);
    if (!fs.existsSync(sqlitePath)) continue;

    const st = fs.statSync(sqlitePath);
    const prev = cache.entries[t.id];
    const dir = path.join(outRoot, t.id);

    const fastMatch =
      !force &&
      prev &&
      prev.coreFingerprint === coreFingerprint &&
      prev.sqliteSize === st.size &&
      prev.sqliteMtimeMs === st.mtimeMs &&
      outputDirIntact(dir, prev.bookFiles);

    if (fastMatch) {
      skipped += 1;
      continue;
    }

    const sqliteSha256 =
      !force && prev && prev.sqliteSize === st.size && prev.sqliteMtimeMs === st.mtimeMs
        ? prev.sqliteSha256
        : sha256File(sqlitePath);

    if (
      !force &&
      prev &&
      prev.coreFingerprint === coreFingerprint &&
      prev.sqliteSha256 === sqliteSha256 &&
      outputDirIntact(dir, prev.bookFiles)
    ) {
      cache.entries[t.id] = { ...prev, sqliteMtimeMs: st.mtimeMs };
      cacheDirty = true;
      skipped += 1;
      continue;
    }

    toBuild.push({
      id: t.id,
      sqliteSize: st.size,
      sqliteMtimeMs: st.mtimeMs,
      sqliteSha256,
    });
  }

  let totalBooks = 0;
  let totalBytes = 0;

  if (toBuild.length > 0) {
    const [{ getScriptureDatabase }, { staticScriptureBookRelPath }] = await Promise.all([
      import("@/lib/bible/scripture-sqlite-db"),
      import("@/lib/bible/static-scripture-shape"),
    ]);

    for (const item of toBuild) {
      const { books, bytes, bookFiles } = await buildTranslation(
        item.id,
        getScriptureDatabase,
        staticScriptureBookRelPath,
      );
      totalBooks += books;
      totalBytes += bytes;
      cache.entries[item.id] = {
        coreFingerprint,
        sqliteSize: item.sqliteSize,
        sqliteMtimeMs: item.sqliteMtimeMs,
        sqliteSha256: item.sqliteSha256,
        bookFiles,
      };
      cacheDirty = true;
      console.log(`  ${(bytes / 1048576).toFixed(1).padStart(6)} MB  ${String(books).padStart(3)} 卷  ${item.id}`);
    }
  }

  if (cacheDirty) writeCache(cache);
  if (skipped > 0) console.log(`  （${skipped} 个译本的 sqlite 未变动，跳过）`);
  console.log(
    `静态经文：${totalBooks} 个文件，${(totalBytes / 1048576).toFixed(1)} MB → public/scripture/`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
