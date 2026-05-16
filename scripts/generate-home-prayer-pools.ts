/**
 * 依 `data/scripture/external-home-verse-rotation.json`（金句主题池）生成
 * `public/data/home-prayer-pools/all/manifest.json` 与 `chunk-*.json`。
 *
 * 用法：仓库根目录 `npx tsx scripts/generate-home-prayer-pools.ts`
 */
import { writeHomePrayerPoolFromGoldenRotation } from "../lib/home-prayer-pools/build-golden-rotation-pool";

const cwd = process.cwd();

void (async () => {
  const r = await writeHomePrayerPoolFromGoldenRotation(cwd);
  console.log(`[home-prayer-pools] ${r.scopeId}: ${r.verseCount} verses, ${r.chunkCount} chunks (golden rotation)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
