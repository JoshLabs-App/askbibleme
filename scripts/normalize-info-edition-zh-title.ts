/**
 * 批量规范已生成导读标题：
 *   # 马太福音第23章导读  ->  # 马太福音 23章
 *
 * 用法：
 *   npx tsx scripts/normalize-info-edition-zh-title.ts
 */
import fs from "node:fs";
import path from "node:path";

type ChapterEntry = {
  markdown?: string;
  charCount?: number;
};

type PublishedDoc = {
  chapters?: Record<string, ChapterEntry>;
};

function normalizeZhInfoTitle(markdown: string): { markdown: string; changed: boolean } {
  const lines = markdown.split(/\r?\n/);
  const firstIdx = lines.findIndex((line) => line.trim().length > 0);
  if (firstIdx < 0) return { markdown, changed: false };

  const first = lines[firstIdx];
  const legacyHeading = first.match(/^(\s*#\s*)(.+?)\s*第?\s*(\d+)\s*章\s*导读\s*$/u);
  if (!legacyHeading) return { markdown, changed: false };

  const [, prefix, bookName, chapterNum] = legacyHeading;
  lines[firstIdx] = `${prefix}${bookName.trim()} ${chapterNum}章`;
  return { markdown: lines.join("\n"), changed: true };
}

function processFile(filePath: string): { scanned: number; changed: number } {
  if (!fs.existsSync(filePath)) return { scanned: 0, changed: 0 };

  const raw = fs.readFileSync(filePath, "utf8");
  const doc = JSON.parse(raw) as PublishedDoc;
  const chapters = doc.chapters ?? {};

  let scanned = 0;
  let changed = 0;
  for (const entry of Object.values(chapters)) {
    if (!entry.markdown?.trim()) continue;
    scanned += 1;
    const next = normalizeZhInfoTitle(entry.markdown);
    if (!next.changed) continue;
    entry.markdown = next.markdown;
    entry.charCount = next.markdown.length;
    changed += 1;
  }

  if (changed > 0) {
    const backup = `${filePath}.bak-before-normalize-zh-title`;
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(filePath, backup);
      console.log(`已备份: ${backup}`);
    }
    fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  return { scanned, changed };
}

function main(): void {
  const cwd = process.cwd();
  const targets = [
    path.join(cwd, "data", "bible", "info-edition-v1-published.json"),
    path.join(cwd, "apps", "askbible-mobile", "assets", "content", "info-edition-v1-published.json"),
  ];

  let totalScanned = 0;
  let totalChanged = 0;
  for (const file of targets) {
    const { scanned, changed } = processFile(file);
    totalScanned += scanned;
    totalChanged += changed;
    console.log(`扫描: ${file}`);
    console.log(`  扫描章节: ${scanned}`);
    console.log(`  修改章节: ${changed}`);
  }

  console.log(`完成：共扫描 ${totalScanned} 章，修改 ${totalChanged} 章。`);
}

main();
