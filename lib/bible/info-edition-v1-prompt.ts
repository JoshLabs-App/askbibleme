import { INFO_EDITION_V1_DEFAULT_SYSTEM } from "@/lib/admin/generation-roles-types";
import type { LoadedChapter } from "@/lib/bible/load-chapter-from-default-translation";

function clipChapterText(chapter: LoadedChapter, maxChars: number): string {
  const lines = chapter.verses.map((v) => `${v.verse} ${v.text}`);
  let body = lines.join("\n");
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars)}\n\n[…经文已截断]`;
}

/**
 * 为「V1 信息版」后台生成：根据一章经文 + 描述规则，产出安静、克制的章节信息摘要。
 */
export function buildInfoEditionV1Messages(
  chapter: LoadedChapter,
  descriptionRules: string,
  opts?: { systemPrompt?: string },
): { role: "system" | "user"; content: string }[] {
  const rules = descriptionRules.trim();
  const ref = `${chapter.bookName} ${chapter.chapter}章`;
  const scripture = clipChapterText(chapter, 12_000);

  const system = opts?.systemPrompt?.trim() || INFO_EDITION_V1_DEFAULT_SYSTEM;

  const userParts = [
    `## 经节范围\n${ref}（译本：${chapter.labelZh || chapter.translationId}）`,
    `## 本章经文\n${scripture}`,
  ];
  if (rules) {
    userParts.push(`## 描述规则（作者填写）\n${rules}`);
  } else {
    userParts.push(
      "## 描述规则\n（作者未填写额外规则：写一段帮助读者安静进入本章的简短信息版文案，点出本章氛围与可留心的方向，不写成查经笔记。）",
    );
  }
  userParts.push(
    "## 任务\n根据以上经文与规则，输出「V1 信息版」正文。",
    "格式要求：使用 Markdown，含 `#` 主标题、`##` 大节、`###` 小节（按需）；正文写在标题下，层次清楚。",
    "仅输出 Markdown 正文，不要解释步骤，不要用代码块包裹全文。",
  );

  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n\n") },
  ];
}
