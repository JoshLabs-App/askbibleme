import { generateInfoEditionChapterForReader } from "@/lib/bible/info-edition-v1-generate-reader";
import {
  clearInfoEditionPending,
  setInfoEditionReaderFailed,
} from "@/lib/bible/info-edition-v1-reader-cache";

/** 读经页后台任务：生成一章并写入发布缓存（由 POST + after 触发） */
export async function runInfoEditionV1ReaderGenerationJob(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<void> {
  try {
    const result = await generateInfoEditionChapterForReader(cwd, bookId, chapter);
    clearInfoEditionPending(cwd, bookId, chapter);
    if (!result.ok) {
      setInfoEditionReaderFailed(cwd, bookId, chapter, result.error);
    }
  } catch (e) {
    clearInfoEditionPending(cwd, bookId, chapter);
    const msg = e instanceof Error ? e.message : String(e);
    setInfoEditionReaderFailed(cwd, bookId, chapter, msg);
  }
}
