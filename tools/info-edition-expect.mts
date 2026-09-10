/**
 * 读后两版归一化规则的 TS 期望值：直接调 RN 的 info-edition-format.ts（纯 TS，无 RN 依赖）。
 * 输入：argv[2] 用例文件（记录以「换行 + U+001E + 换行」分隔，每条第一行是 variant，其余是 markdown）。
 * 输出：JSON 数组 [{h, b}]，h/b 是 splitPrimaryHeading 后的页头与正文。
 */
import { readFileSync } from "node:fs";
import * as fmtNs from "../apps/askbible-mobile/src/bible/info-edition-format";

const unwrap = (ns: any) => (ns && ns.default && typeof ns.default === "object" && !ns.normalizeInfoEditionCompareMarkdown ? ns.default : ns);
const fmt = unwrap(fmtNs);

/** 与 RN ReadChapterInfoEditionMarkdown 的私有 splitPrimaryHeading 同一段逻辑（那文件依赖 react-native，无法直接 import） */
function splitPrimaryHeading(markdown: string): { heading: string | null; body: string } {
  const lines = markdown.split(/\r?\n/);
  const firstMeaningful = lines.findIndex((line) => line.trim().length > 0);
  if (firstMeaningful < 0) return { heading: null, body: markdown };
  const m = lines[firstMeaningful].match(/^#\s+(.+)$/);
  if (!m) return { heading: null, body: markdown };
  const next = [...lines];
  next.splice(firstMeaningful, 1);
  if (firstMeaningful < next.length && next[firstMeaningful].trim() === "") next.splice(firstMeaningful, 1);
  return { heading: m[1].trim(), body: next.join("\n").trim() };
}

const raw = readFileSync(process.argv[2], "utf8");
const cases = raw.split("\n\x1e\n").filter((c) => c.length > 0);
const out = cases.map((c) => {
  const nl = c.indexOf("\n");
  const variant = c.slice(0, nl);
  const markdown = c.slice(nl + 1);
  let text = fmt.normalizeInfoEditionCompareMarkdown(markdown);
  if (variant === "info") text = fmt.stripInfoEditionSectionByHeading(text, fmt.INFO_EDITION_KEY_SCENES_HEADING_PATTERNS);
  const { heading, body } = splitPrimaryHeading(text);
  return { h: heading, b: body };
});
process.stdout.write(JSON.stringify(out));
