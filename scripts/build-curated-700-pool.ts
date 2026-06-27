/**
 * 生成探索默认 700 句静态 home-prayer-pool。
 *
 * 用法（仓库根目录）：
 *   npm run build:curated-700-pool
 */
import { writeCuratedPrayerPool } from "../lib/home-prayer-pools/build-curated-prayer-pool";

const cwd = process.cwd();

void writeCuratedPrayerPool(cwd)
  .then((r) => {
    console.log(
      `[curated-700-pool] ${r.scopeId}: ${r.verseCount} verses, ${r.chunkCount} chunks` +
        (r.skippedResolve ? ` (skipped ${r.skippedResolve} unresolved)` : ""),
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
