import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

/** 讲解版目标约 1200–1800 字 + 六模块，需足够输出 token */
export const INFO_EDITION_READER_MAX_TOKENS_INFO = 4_096;

/** 发现版四段（观察/解释/应用/总结），长章更易被截断 */
export const INFO_EDITION_READER_MAX_TOKENS_GUIDE = 6_144;

export function infoEditionReaderMaxTokens(variant: InfoEditionReaderVariant): number {
  const raw =
    variant === "guide"
      ? process.env.INFO_EDITION_READER_MAX_TOKENS_GUIDE?.trim()
      : process.env.INFO_EDITION_READER_MAX_TOKENS_INFO?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 512 && n <= 32_000) return n;
  }
  return variant === "guide"
    ? INFO_EDITION_READER_MAX_TOKENS_GUIDE
    : INFO_EDITION_READER_MAX_TOKENS_INFO;
}
