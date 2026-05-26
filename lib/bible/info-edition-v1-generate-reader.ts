import {
  executeInfoEditionReaderPlan,
  planInfoEditionReaderGeneration,
} from "@/lib/bible/info-edition-v1-reader-generate-plan";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";
import type { ResolvedInfoEditionReaderTarget } from "@/lib/bible/info-edition-v1-reader-persistence";

export type GenerateReaderChapterResult =
  | { ok: true; published: InfoEditionV1PublishedChapter }
  | { ok: false; error: string };

export type GenerateInfoEditionReaderOpts = {
  /** 与后台「讲解版投送」相同：仅 info 使用；guide 始终忽略 */
  descriptionRulesOverride?: string | null;
  translationIdOverride?: string | null;
  outputLanguage?: "zh-CN" | "en";
};

/** 读经页 / 全本批量：与后台 reader-generate「确认生成」同源（plan → execute → publish） */
export async function generateInfoEditionChapterForReader(
  cwd: string,
  bookId: string,
  chapter: number,
  target: ResolvedInfoEditionReaderTarget,
  opts?: GenerateInfoEditionReaderOpts,
): Promise<GenerateReaderChapterResult> {
  const planned = await planInfoEditionReaderGeneration(cwd, bookId, chapter, target, {
    descriptionRulesOverride: opts?.descriptionRulesOverride,
    translationIdOverride: opts?.translationIdOverride,
    outputLanguage: opts?.outputLanguage,
  });
  if (!planned.ok) return { ok: false, error: planned.error };

  const executed = await executeInfoEditionReaderPlan(cwd, bookId, chapter, planned.plan, {
    publish: true,
  });
  if (!executed.ok) return { ok: false, error: executed.error };
  if (!executed.published) {
    return { ok: false, error: "生成结果无效，无法发布。" };
  }

  return { ok: true, published: executed.published };
}
