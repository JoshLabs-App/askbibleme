/**
 * 从 data/bible/info-edition-v1-published.json 的发现版正文中删除「经文祷告」模块。
 *
 * 用法：
 *   npm run info-edition:strip-guide-prayer
 *   INFO_EDITION_DATA_DIR=/var/data npm run info-edition:strip-guide-prayer
 */
import fs from "node:fs";
import path from "node:path";
import { stripGuidePrayerSectionFromMarkdown } from "@/lib/bible/strip-guide-prayer-from-markdown";
import { INFO_EDITION_GUIDE_V2_ROLE_ID } from "@/lib/bible/info-edition-v1-publish";
import {
  infoEditionBundledPublishedPath,
  infoEditionWritablePublishedPath,
} from "@/lib/bible/info-edition-published-path";

const cwd = process.cwd();
const publishedPath =
  infoEditionWritablePublishedPath(cwd) ?? infoEditionBundledPublishedPath(cwd);

type ChapterEntry = { roleId?: string; markdown?: string; charCount?: number };

function main(): void {
  if (!fs.existsSync(publishedPath)) {
    console.error(`找不到 published 文件：${publishedPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(publishedPath, "utf8");
  const doc = JSON.parse(raw) as { chapters?: Record<string, ChapterEntry> };
  const chapters = doc.chapters ?? {};

  let scanned = 0;
  let stripped = 0;

  for (const entry of Object.values(chapters)) {
    if (entry.roleId !== INFO_EDITION_GUIDE_V2_ROLE_ID || !entry.markdown?.trim()) continue;
    scanned += 1;
    const result = stripGuidePrayerSectionFromMarkdown(entry.markdown);
    if (result.stripped) {
      entry.markdown = result.markdown;
      entry.charCount = result.markdown.length;
      stripped += 1;
    }
  }

  if (stripped === 0) {
    console.log(`扫描发现版 ${scanned} 章，无需删除祷告模块。`);
    return;
  }

  const backup = `${publishedPath}.bak-before-strip-prayer`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(publishedPath, backup);
    console.log(`已备份 → ${backup}`);
  }

  fs.writeFileSync(publishedPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`完成：${stripped}/${scanned} 章已移除「经文祷告」模块 → ${publishedPath}`);
}

main();
