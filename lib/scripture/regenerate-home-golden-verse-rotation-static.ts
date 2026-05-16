import { buildResolvedHomeVerseRotationSnapshot } from "@/lib/bible/home-verse-ref-rotation";
import { writeHomeGoldenVerseRotationStaticSync } from "@/lib/scripture/home-golden-verse-rotation-static-file";

/** 依当前 `external-home-verse-rotation.json` 与已导入译本，写入首页金句轮播静态快照（供 RSC 直读）。 */
export async function regenerateHomeGoldenVerseRotationStatic(cwd: string): Promise<void> {
  const snap = await buildResolvedHomeVerseRotationSnapshot(cwd);
  writeHomeGoldenVerseRotationStaticSync(cwd, {
    version: 1,
    verseRefsCount: snap.verseRefsCount,
    entriesByLocale: snap.entriesByLocale,
  });
}
