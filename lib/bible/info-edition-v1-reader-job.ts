import { generateInfoEditionChapterForReader } from "@/lib/bible/info-edition-v1-generate-reader";
import {
  clearInfoEditionPendingAsync,
  setInfoEditionReaderFailedAsync,
  type ResolvedInfoEditionReaderTarget,
} from "@/lib/bible/info-edition-v1-reader-persistence";

/** 读经页后台任务：生成一章并写入发布缓存（由 POST + after 触发） */
export async function runInfoEditionV1ReaderGenerationJob(
  cwd: string,
  bookId: string,
  chapter: number,
  target: ResolvedInfoEditionReaderTarget,
): Promise<void> {
  try {
    const result = await generateInfoEditionChapterForReader(cwd, bookId, chapter, target);
    await clearInfoEditionPendingAsync(cwd, bookId, chapter, target);
    if (!result.ok) {
      await setInfoEditionReaderFailedAsync(cwd, bookId, chapter, result.error, target);
    }
  } catch (e) {
    await clearInfoEditionPendingAsync(cwd, bookId, chapter, target);
    const msg = e instanceof Error ? e.message : String(e);
    await setInfoEditionReaderFailedAsync(cwd, bookId, chapter, msg, target);
  }
}
