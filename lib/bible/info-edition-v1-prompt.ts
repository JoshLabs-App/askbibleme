import { INFO_EDITION_V1_DEFAULT_SYSTEM } from "@/lib/admin/generation-roles-types";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";
import type { LoadedChapter } from "@/lib/bible/load-chapter-from-default-translation";

function clipChapterText(chapter: LoadedChapter, maxChars: number): string {
  const lines = chapter.verses.map((v) => `${v.verse} ${v.text}`);
  let body = lines.join("\n");
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars)}\n\n[…经文已截断]`;
}

export type BuildInfoEditionV1MessagesOpts = {
  /** 角色完整规范，作为 API 的 system 消息原样发送 */
  systemPrompt?: string;
  variant?: InfoEditionReaderVariant;
  outputLanguage?: "zh-CN" | "en";
};

/**
 * 构建发往模型的 messages：与 API 请求体一致，不含给人看的说明层。
 * - system：generation-roles 中该角色的 systemPrompt
 * - user：经节 + 经文 +（导读）描述规则与任务 /（引导）仅经文与可选补充
 */
export function buildInfoEditionV1Messages(
  chapter: LoadedChapter,
  descriptionRules: string,
  opts?: BuildInfoEditionV1MessagesOpts,
): { role: "system" | "user"; content: string }[] {
  const variant = opts?.variant ?? "info";
  const outputLanguage = opts?.outputLanguage ?? "zh-CN";
  const rules = descriptionRules.trim();
  const refZh = `${chapter.bookName} ${chapter.chapter}章`;
  const refEn = `${chapter.bookName} ${chapter.chapter}`;
  const ref = outputLanguage === "en" ? refEn : refZh;
  const scripture = clipChapterText(chapter, 12_000);

  const system = opts?.systemPrompt?.trim() || INFO_EDITION_V1_DEFAULT_SYSTEM;

  const translationLabel =
    outputLanguage === "en"
      ? chapter.labelEn || chapter.translationId
      : chapter.labelZh || chapter.translationId;

  const userParts =
    outputLanguage === "en"
      ? [
          `## Passage\n${ref} (Translation: ${translationLabel})`,
          `## Scripture\n${scripture}`,
        ]
      : [
          `## 经节范围\n${ref}（译本：${translationLabel}）`,
          `## 本章经文\n${scripture}`,
        ];

  if (variant === "guide") {
    if (rules) {
      userParts.push(
        outputLanguage === "en"
          ? `## Additional Notes (from editor)\n${rules}`
          : `## 补充说明（作者填写）\n${rules}`,
      );
    }
    if (outputLanguage === "en") {
      userParts.push(
        "## Output requirements",
        "Write the entire study-guide response in English.",
        "Use clear Markdown headings and keep the structure: Observation -> Interpretation -> Application -> One-sentence summary.",
        "Do not include Chinese content unless it appears inside quoted Scripture.",
      );
    }
  } else {
    if (rules) {
      userParts.push(
        outputLanguage === "en"
          ? `## Description Rules (from editor)\n${rules}`
          : `## 描述规则（作者填写）\n${rules}`,
      );
    } else {
      userParts.push(
        outputLanguage === "en"
          ? "## Description Rules\n(No extra editor rules provided: write a concise, calm English introduction that helps readers quietly enter this chapter, highlighting atmosphere and what to pay attention to.)"
          : "## 描述规则\n（作者未填写额外规则：写一段帮助读者安静进入本章的简短信息版文案，点出本章氛围与可留心的方向，不写成查经笔记。）",
      );
    }
    if (outputLanguage === "en") {
      userParts.push(
        "## Task\nBased on the Scripture and rules above, write the chapter's V1 reading introduction in English.",
        "Formatting: use Markdown with `#` main title, `##` major sections, and `###` subsections as needed.",
        "Output only final Markdown content. Do not explain your process. Do not wrap the full response in code fences.",
      );
    } else {
      userParts.push(
        "## 任务\n根据以上经文与规则，输出本章导读正文。",
        "主标题必须严格使用：`# 书卷名 章号章`（例如：`# 马太福音 23章`），不要写“第”，不要写“导读”。",
        "格式要求：使用 Markdown，含 `#` 主标题、`##` 大节、`###` 小节（按需）；正文写在标题下，层次清楚。",
        "仅输出 Markdown 正文，不要解释步骤，不要用代码块包裹全文。",
      );
    }
  }

  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n\n") },
  ];
}
