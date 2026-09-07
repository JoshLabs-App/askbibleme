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
 * 需用 scripts/tsconfig.config-build.json 跑（server-only stub）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadChapterXrefs } from "@/lib/bible/load-chapter-xrefs";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import {
  STATIC_XREFS_DIR_REL,
  staticXrefsBookRelPath,
  type StaticXrefsBookFile,
} from "@/lib/bible/static-xrefs-shape";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(repoRoot, STATIC_XREFS_DIR_REL);

async function main(): Promise<void> {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  let files = 0;
  let bytes = 0;
  let chaptersWithXrefs = 0;

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
    fs.writeFileSync(path.join(repoRoot, staticXrefsBookRelPath(book.bookId)), body, "utf8");
    files += 1;
    bytes += Buffer.byteLength(body);
  }

  console.log(
    `静态交叉引用：${files} 个文件，${chaptersWithXrefs} 章有 xref，` +
      `${(bytes / 1048576).toFixed(1)} MB → ${STATIC_XREFS_DIR_REL}/`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
