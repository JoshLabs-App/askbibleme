import { after } from "next/server";
import { runInfoEditionV1ReaderGenerationJob } from "@/lib/bible/info-edition-v1-reader-job";

/** 在响应返回后继续生成；若 after() 不可用则退回 setImmediate（Render 等自托管） */
export function scheduleInfoEditionV1ReaderJob(
  cwd: string,
  bookId: string,
  chapter: number,
): void {
  const run = () =>
    runInfoEditionV1ReaderGenerationJob(cwd, bookId, chapter).catch((err) => {
      console.error("[info-edition-v1] background job failed", bookId, chapter, err);
    });

  try {
    after(run);
  } catch (err) {
    console.warn("[info-edition-v1] after() unavailable, using setImmediate", err);
    setImmediate(run);
  }
}
