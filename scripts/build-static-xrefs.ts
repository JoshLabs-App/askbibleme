#!/usr/bin/env node
/**
 * 从 data/bible/sqlite/scripture-xrefs.sqlite 生成按卷切分的静态交叉引用：
 *
 *   public/xrefs/{BOOK}.json
 *
 *   npm run build:static-xrefs
 *
 * 与经文静态化同一目的：读经页每章都要取 xref，原来每次都要打开 1.7MB 的 sqlite，
 * 是网站运行时对 sqlite 的最后一处依赖。切成按卷文件后不再需要 fs，边缘运行时可用。
 *
 * 直接调用 loadChapterXrefs 本身来生成，而不是另写一遍 SQL——保证产出与线上现有逻辑
 * 逐字一致（含 incoming/outgoing 的排序与 priority 处理）。
 *
 * 产物不入库（.gitignore），由 prebuild 生成。
 * 增量缓存：scripture-xrefs.sqlite 与脚本指纹未变且产物完整时跳过 WASM 加载；支持 FORCE_PREBUILD=1。
 * 需用 scripts/tsconfig.config-build.json 跑（server-only stub）。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StaticXrefsBookFile } from "@/lib/bible/static-xrefs-shape";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const outRoot = path.join(repoRoot, "public", "xrefs");
const cachePath = path.join(repoRoot, "node_modules", ".cache", "askbible-prebuild", "build-static-xrefs.json");
const force = process.argv.includes("--force") || process.env.FORCE_PREBUILD === "1";

type CacheFile = {
  version: 1;
  fingerprint: string;
  files: string[];
};

function sha256File(absPath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function computeFingerprint(): string {
  const hash = crypto.createHash("sha256");
  const inputs = [
    scriptPath,
    path.join(repoRoot, "lib/bible/load-chapter-xrefs.ts"),
    path.join(repoRoot, "lib/bible/scripture-xref-db.ts"),
    path.join(repoRoot, "lib/bible/scripture-xref-sqlite-path.ts"),
    path.join(repoRoot, "lib/bible/scripture-books.ts"),
    path.join(repoRoot, "lib/bible/static-xrefs-shape.ts"),
    path.join(repoRoot, "data/bible/sqlite/scripture-xrefs.sqlite"),
  ];
  for (const abs of inputs) {
    if (!fs.existsSync(abs)) {
      hash.update(`${abs}:missing\n`);
      continue;
    }
    const st = fs.statSync(abs);
    hash.update(`${path.relative(repoRoot, abs)}:${st.size}:${sha256File(abs)}\n`);
  }
  return hash.digest("hex");
}

function readCache(): CacheFile | null {
  if (!fs.existsSync(cachePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Partial<CacheFile>;
    if (parsed?.version === 1 && typeof parsed.fingerprint === "string" && Array.isArray(parsed.files)) {
      return { version: 1, fingerprint: parsed.fingerprint, files: parsed.files };
    }
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

function outputIntact(expectedFiles: string[]): boolean {
  if (expectedFiles.length === 0 || !fs.existsSync(outRoot)) return false;
  let actual: string[];
  try {
    actual = fs.readdirSync(outRoot).filter((n) => n.endsWith(".json"));
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

async function main(): Promise<void> {
  const fingerprint = computeFingerprint();
  const prev = readCache();
  if (!force && prev && prev.fingerprint === fingerprint && outputIntact(prev.files)) {
    console.log(`静态交叉引用：未变动，跳过（${prev.files.length} 个文件 → public/xrefs/）`);
    return;
  }

  const [{ loadChapterXrefs }, { scriptureBooks }, { STATIC_XREFS_DIR_REL, staticXrefsBookRelPath }] =
    await Promise.all([
      import("@/lib/bible/load-chapter-xrefs"),
      import("@/lib/bible/scripture-books"),
      import("@/lib/bible/static-xrefs-shape"),
    ]);

  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  let files = 0;
  let bytes = 0;
  let chaptersWithXrefs = 0;
  const writtenFiles: string[] = [];

  for (const book of scriptureBooks) {
    const chapters: StaticXrefsBookFile["c"] = {};
    for (let ch = 1; ch <= book.chapters; ch += 1) {
      /** 生成期直接读 sqlite：此时静态产物还不存在，loadChapterXrefs 会回落过去。 */
      const rows = await loadChapterXrefs(repoRoot, book.bookId, ch);
      if (!rows || rows.length === 0) continue;
      chapters[String(ch)] = rows;
      chaptersWithXrefs += 1;
    }
    /** 整卷无 xref 就不写文件；读取端取不到会当作「本章没有」，与 sqlite 结果一致。 */
    if (Object.keys(chapters).length === 0) continue;
    const body = JSON.stringify({ v: 1, c: chapters } satisfies StaticXrefsBookFile);
    const rel = staticXrefsBookRelPath(book.bookId);
    fs.writeFileSync(path.join(repoRoot, rel), body, "utf8");
    writtenFiles.push(path.basename(rel));
    files += 1;
    bytes += Buffer.byteLength(body);
  }

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(
    cachePath,
    `${JSON.stringify({ version: 1, fingerprint, files: writtenFiles } satisfies CacheFile)}\n`,
    "utf8",
  );

  console.log(
    `静态交叉引用：${files} 个文件，${chaptersWithXrefs} 章有 xref，` +
      `${(bytes / 1048576).toFixed(1)} MB → ${STATIC_XREFS_DIR_REL}/`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
