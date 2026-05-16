/**
 * 依 `data/scripture/external-home-verse-rotation.json` 与已导入译本，生成
 * `data/scripture/home-golden-verse-rotation-static.json`，供壳层 RSC 直读轮播正文（避免请求时逐条解析）。
 *
 * 在只改 refs JSON、未走管理保存接口时，于仓库根目录执行：
 *   npx tsx scripts/generate-home-golden-verse-rotation-static.ts
 */
import { regenerateHomeGoldenVerseRotationStatic } from "../lib/scripture/regenerate-home-golden-verse-rotation-static";

async function main() {
  const cwd = process.cwd();
  await regenerateHomeGoldenVerseRotationStatic(cwd);
  console.log("[home-golden-verse-static] wrote data/scripture/home-golden-verse-rotation-static.json");
}

main().catch((e) => {
  console.error("[home-golden-verse-static]", e);
  process.exit(1);
});
