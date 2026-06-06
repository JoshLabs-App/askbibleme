import type {
  YearsDaysEternityBlock,
  YearsDaysEternityScriptureBlock,
} from "./years-days-eternity-types";

export function filterEternityScriptures(
  blocks: YearsDaysEternityBlock[],
): YearsDaysEternityScriptureBlock[] {
  return blocks.filter((b): b is YearsDaysEternityScriptureBlock => b.type === "scripture");
}

export function filterEternityProse(blocks: YearsDaysEternityBlock[]): string[][] {
  return blocks
    .filter((b) => b.type === "prose")
    .map((b) => (b.type === "prose" ? b.lines : []));
}

/** 单段经文正文：去掉空行后连成一行，便于右侧紧凑排版 */
export function formatScriptureBlockBody(lines: string[]): string {
  const cleaned = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  const hasHan = cleaned.some((line) => /[\p{Script=Han}]/u.test(line));
  return cleaned.join(hasHan ? "" : " ");
}
