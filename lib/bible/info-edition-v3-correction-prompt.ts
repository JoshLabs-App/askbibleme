import type { InfoEditionV3CorrectionPhase } from "@/lib/bible/info-edition-v3-correction-roles";
import type { InfoEditionV3ChapterSource } from "@/lib/bible/info-edition-v3-correction-types";
import type { LoadedChapter } from "@/lib/bible/load-chapter-from-default-translation";

function clipText(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[…已截断]`;
}

function scriptureBlock(chapter: LoadedChapter | InfoEditionV3ChapterSource): string {
  if ("verses" in chapter) {
    return chapter.verses.map((v) => `${v.verse} ${v.text}`).join("\n");
  }
  return chapter.scripture;
}

export type BuildV3CorrectionMessagesOpts = {
  phase: InfoEditionV3CorrectionPhase;
  systemPrompt: string;
  source: InfoEditionV3ChapterSource;
  critiqueText?: string;
  editorNotes?: string;
};

export function buildInfoEditionV3CorrectionMessages(
  opts: BuildV3CorrectionMessagesOpts,
): { role: "system" | "user"; content: string }[] {
  const { phase, systemPrompt, source } = opts;
  const ref = `${source.bookName} ${source.chapter}章`;
  const scripture = clipText(scriptureBlock(source), 12_000);
  const editorNotes = opts.editorNotes?.trim() ?? "";
  const critiqueText = opts.critiqueText?.trim() ?? "";

  const userParts = [`## 经节范围\n${ref}（译本：${source.labelZh}）`, `## 本章经文\n${scripture}`];

  if (editorNotes) {
    userParts.push(`## 编辑补充说明\n${editorNotes}`);
  }

  if (phase === "critique") {
    userParts.push(
      "## 任务",
      "同时审阅下方「讲解版 V1」与「发现版 V2」已发布正文，找出问题。",
      "只列问题，不要输出修订后的正文，不要写完整改稿。",
      "讲解版与发现版的问题须分开列出。",
    );
    if (source.infoV1?.markdown.trim()) {
      userParts.push(
        `## 已有发布稿 · 讲解版 V1\n${clipText(source.infoV1.markdown, 14_000)}`,
      );
    } else {
      userParts.push("## 已有发布稿 · 讲解版 V1\n（本章尚无已发布讲解版）");
    }
    if (source.guideV2?.markdown.trim()) {
      userParts.push(
        `## 已有发布稿 · 发现版 V2\n${clipText(source.guideV2.markdown, 14_000)}`,
      );
    } else {
      userParts.push("## 已有发布稿 · 发现版 V2\n（本章尚无已发布发现版）");
    }
    userParts.push(
      "## 输出要求",
      "按 system 规定的 Markdown 结构输出。",
      "只诊断，不要输出修订后的完整正文。",
    );
  } else if (phase === "revise_info") {
    if (!source.infoV1?.markdown.trim()) {
      userParts.push("## 错误\n本章没有已发布讲解版 V1，无法修订。");
    } else {
      userParts.push(`## 已有发布稿（待修订 · 讲解版 V1）\n${clipText(source.infoV1.markdown, 14_000)}`);
    }
    if (!critiqueText) {
      userParts.push("## 错误\n缺少「修订清单 / 批判结果」，请先运行批判 pass 或粘贴 critiqueText。");
    } else {
      userParts.push(`## 修订清单 / 批判结果\n${clipText(critiqueText, 8_000)}`);
    }
    userParts.push(
      "## 输出要求",
      "输出完整修订后的讲解版 Markdown 正文。",
      "保持原模块结构（概览、历史背景、神学解释等）。",
      "未在修订清单中的句子尽量保持原样。",
      "不要输出解释你如何修订。",
    );
  } else {
    if (!source.guideV2?.markdown.trim()) {
      userParts.push("## 错误\n本章没有已发布发现版 V2，无法修订。");
    } else {
      userParts.push(`## 已有发布稿（待修订 · 发现版 V2）\n${clipText(source.guideV2.markdown, 14_000)}`);
    }
    if (!critiqueText) {
      userParts.push("## 错误\n缺少「修订清单 / 批判结果」，请先运行批判 pass 或粘贴 critiqueText。");
    } else {
      userParts.push(`## 修订清单 / 批判结果\n${clipText(critiqueText, 8_000)}`);
    }
    userParts.push(
      "## 输出要求",
      "输出完整修订后的发现版 Markdown 正文。",
      "保持观察 → 解释 → 应用 → 一句话总结结构。",
      "未在修订清单中的句子尽量保持原样。",
      "不要输出解释你如何修订。",
    );
  }

  return [
    { role: "system", content: systemPrompt.trim() },
    { role: "user", content: userParts.join("\n\n") },
  ];
}
