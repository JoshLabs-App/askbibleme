import { generateInfoEditionChapterForReader } from "@/lib/bible/info-edition-v1-generate-reader";
import {
  validateInfoEditionOutput,
  type InfoEditionOutputValidation,
} from "@/lib/bible/info-edition-v1-output-validate";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";
import type { ResolvedInfoEditionReaderTarget } from "@/lib/bible/info-edition-v1-reader-persistence";

export type GenerateChapterWithValidationResult = {
  ok: boolean;
  published: InfoEditionV1PublishedChapter | null;
  check: InfoEditionOutputValidation | null;
  attempts: number;
  error?: string;
  checkSummary?: string;
};

export function infoEditionBatchValidateRetries(): number {
  const raw = process.env.INFO_EDITION_BATCH_VALIDATE_RETRIES?.trim();
  if (!raw) return 2;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 2;
  return Math.min(n, 5);
}

/**
 * 生成一章并校验结构；校验失败时自动重试（默认再试 2 次，共 3 次）。
 */
export async function generateInfoEditionChapterWithValidation(
  cwd: string,
  bookId: string,
  chapter: number,
  target: ResolvedInfoEditionReaderTarget,
  opts?: {
    descriptionRulesOverride?: string | null;
    translationIdOverride?: string | null;
    outputLanguage?: "zh-CN" | "en";
    maxRetries?: number;
  },
): Promise<GenerateChapterWithValidationResult> {
  const edition = target.variant;
  const maxRetries = opts?.maxRetries ?? infoEditionBatchValidateRetries();
  const genOpts =
    edition === "info" && opts?.descriptionRulesOverride
      ? {
          descriptionRulesOverride: opts.descriptionRulesOverride,
          translationIdOverride: opts.translationIdOverride,
          outputLanguage: opts.outputLanguage,
        }
      : {
          translationIdOverride: opts?.translationIdOverride,
          outputLanguage: opts?.outputLanguage,
        };

  let lastCheck: InfoEditionOutputValidation | null = null;
  let lastPublished: InfoEditionV1PublishedChapter | null = null;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await generateInfoEditionChapterForReader(
      cwd,
      bookId,
      chapter,
      target,
      genOpts,
    );
    if (!result.ok) {
      lastError = result.error;
      lastCheck = null;
      lastPublished = null;
      if (attempt < maxRetries) continue;
      return {
        ok: false,
        published: null,
        check: null,
        attempts: attempt + 1,
        error: result.error,
      };
    }

    const check = validateInfoEditionOutput(result.published.markdown, edition, {
      outputLanguage: opts?.outputLanguage,
    });
    lastCheck = check;
    lastPublished = result.published;

    if (check.ok) {
      return {
        ok: true,
        published: result.published,
        check,
        attempts: attempt + 1,
      };
    }

    lastError = check.checks.map((c) => c.message).join("; ");
    if (attempt < maxRetries) continue;
  }

  return {
    ok: false,
    published: lastPublished,
    check: lastCheck,
    attempts: maxRetries + 1,
    error: lastError ?? "校验未通过。",
    checkSummary: lastError,
  };
}

export function summarizeValidationIssues(
  check: InfoEditionOutputValidation,
  variant: InfoEditionReaderVariant,
): string {
  return check.checks.map((c) => c.message).join("; ");
}
