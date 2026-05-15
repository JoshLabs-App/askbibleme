/**
 * 为已存在的 openbible-topics.sqlite 补齐派生列：`verse_count`、陪伴方向 `dir_quiet` / `dir_pray` / `dir_form`。
 * 新库请直接 `npm run import:openbible-topics`。
 *
 * 用法：npx tsx scripts/backfill-openbible-verse-count.ts
 */
import fs from "node:fs";
import { migrateOpenbibleTopicExtensionsInPlace } from "../lib/bible/migrate-openbible-topic-extensions";
import { invalidateOpenbibleTopicsDbCache, openbibleTopicsSqlitePath } from "../lib/bible/openbible-topics-db";

async function main() {
  const cwd = process.cwd();
  const outAbs = openbibleTopicsSqlitePath(cwd);
  if (!fs.existsSync(outAbs)) {
    console.error(`找不到 SQLite：${outAbs}`);
    process.exit(1);
  }

  await migrateOpenbibleTopicExtensionsInPlace(cwd);
  invalidateOpenbibleTopicsDbCache();

  console.log(`已写入 verse_count 与陪伴方向列：${outAbs}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
