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
  const rules = descriptionRules.trim();
  const ref = `${chapter.bookName} ${chapter.chapter}章`;
  const scripture = clipChapterText(chapter, 12_000);

  const system = opts?.systemPrompt?.trim() || INFO_EDITION_V1_DEFAULT_SYSTEM;

  const userParts = [
    `## 经节范围\n${ref}（译本：${chapter.labelZh || chapter.translationId}）`,
    `## 本章经文\n${scripture}`,
  ];

  if (variant === "guide") {
    if (rules) {
      userParts.push(`## 补充说明（作者填写）\n${rules}`);
    }
  } else {
    if (rules) {
      userParts.push(`## 描述规则（作者填写）\n${rules}`);
    } else {
      userParts.push(
        "## 描述规则\n（作者未填写额外规则：写一段帮助读者安静进入本章的简短信息版文案，点出本章氛围与可留心的方向，不写成查经笔记。）",
      );
    }
    userParts.push(
      "## 任务\n根据以上经文与规则，输出本章导读正文。",
      "格式要求：使用 Markdown，含 `#` 主标题、`##` 大节、`###` 小节（按需）；正文写在标题下，层次清楚。",
      "仅输出 Markdown 正文，不要解释步骤，不要用代码块包裹全文。",
    );
  }

  return [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n\n") },
  ];
}
