import type { InfoEditionV4RolePhase } from "@/lib/bible/info-edition-v4-roles";

function clipText(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[…已截断]`;
}

export type BuildV4MessagesOpts = {
  phase: InfoEditionV4RolePhase;
  systemPrompt: string;
  themeTitle: string;
  editorNotes?: string;
  compileText?: string;
  reviewText?: string;
};

export function buildInfoEditionV4Messages(
  opts: BuildV4MessagesOpts,
): { role: "system" | "user"; content: string }[] {
  const themeTitle = opts.themeTitle.trim() || "（未命名主题）";
  const editorNotes = opts.editorNotes?.trim() ?? "";
  const compileText = opts.compileText?.trim() ?? "";
  const reviewText = opts.reviewText?.trim() ?? "";

  const userParts = [
    `## 主题\n${themeTitle}`,
    "## 说明",
    "格式、结构、篇幅与神学边界以 system（生成角色）中的定义为准；本消息不重复规则。",
  ];

  if (editorNotes) {
    userParts.push(`## 编辑补充（可选）\n${editorNotes}`);
  }

  if (opts.phase === "compile") {
    userParts.push(
      "## 任务",
      `围绕主题「${themeTitle}」，从经文出发作出回应：先列出处与和合本引文，再作简短、正统讲解；不过度解释，不自行创作。`,
      "只输出最终 Markdown 正文，不要解释生成过程。",
    );
  } else if (opts.phase === "review") {
    if (!compileText) {
      userParts.push("## 错误\n缺少待审核的汇编初稿。请先完成一次汇编或粘贴初稿。");
    } else {
      userParts.push(`## 待审核 · 汇编初稿\n${clipText(compileText, 16_000)}`);
    }
    userParts.push("## 任务", "按 system 中的审核标准评估初稿。", "只输出审核报告，不要输出修订后的完整汇编。");
  } else {
    if (!compileText) {
      userParts.push("## 错误\n缺少汇编初稿，无法修订。");
    } else {
      userParts.push(`## 汇编初稿\n${clipText(compileText, 14_000)}`);
    }
    if (!reviewText) {
      userParts.push(
        "## 任务",
        "直接对「汇编初稿」做严谨优化修正（无单独审核步骤）：检查和合本引文与出处、删弱相关与过度解释、补遗漏关键经文；仍须从经文出发，先经后解，正统从简，不创作。",
        "输出完整修订 Markdown 正文。",
      );
    } else {
      userParts.push(`## 审核意见\n${clipText(reviewText, 10_000)}`);
      userParts.push(
        "## 任务",
        "落实审核意见中的必改项，输出修订后的完整汇编 Markdown。",
        "仍须遵守 system 中汇编角色的结构与原则。",
      );
    }
  }

  return [
    { role: "system", content: opts.systemPrompt },
    { role: "user", content: userParts.join("\n\n") },
  ];
}
