#!/usr/bin/env node
/**
 * 把 data/bible/sqlite/info-edition.sqlite 复制进 App 资源目录，替代原先随包的
 * 22.5MB JSON（assets/content/info-edition-v1-published.json）。
 *
 *   npm run mobile:sync-info-edition
 *
 * 与 sync-mobile-scripture-sqlite.mjs 同一套路：真源在主仓 data/，App 只拿构建产物。
 * 换成 sqlite 是为了让读经页按章查询，而不是一进页面就同步 JSON.parse 全本 4761 章。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(repoRoot, "data", "bible", "sqlite", "info-edition.sqlite");
const destDir = path.join(repoRoot, "apps", "askbible-mobile", "assets", "content");
const dest = path.join(destDir, "info-edition.sqlite");

if (!fs.existsSync(src)) {
  console.error(
    `[sync-mobile-info-edition] 缺少 ${path.relative(repoRoot, src)}；先跑 npm run build:info-edition-sqlite`,
  );
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

/** 内容一致就不动文件，避免每次都让 Metro/Xcode 认为资源变了而重打包。 */
const srcStat = fs.statSync(src);
if (fs.existsSync(dest)) {
  const destStat = fs.statSync(dest);
  if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
    console.log(`[sync-mobile-info-edition] 已是最新（${(srcStat.size / 1048576).toFixed(1)} MB），跳过`);
    process.exit(0);
  }
}

fs.copyFileSync(src, dest);
console.log(
  `[sync-mobile-info-edition] ${(srcStat.size / 1048576).toFixed(1)} MB → ${path.relative(repoRoot, dest)}`,
);
