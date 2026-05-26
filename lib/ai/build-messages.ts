import type { AIChatContext, AssistantActionId } from "./types";

const MAX_DOC = 14_000;

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n[…已截断，原文过长]`;
}

const MAX_DIALOG_MSG = 1_200;
const MAX_DIALOG_TURNS = 10;

function formatDialogForAction(
  msgs: NonNullable<AIChatContext["dialogMessages"]>,
): string {
  return msgs
    .slice(-MAX_DIALOG_TURNS)
    .map((m) => {
      const label = m.role === "user" ? "用户" : "助理";
      return `${label}：${clip(m.content, MAX_DIALOG_MSG)}`;
    })
    .join("\n\n");
}

function contextBlockDocWorkspace(ctx: AIChatContext): string {
  const parts = [
    `## 当前文档标题\n${ctx.docTitle}`,
    `## 当前文档正文（Markdown）\n${clip(ctx.docBody, MAX_DOC)}`,
  ];
  if (ctx.captureSnippet?.trim()) {
    parts.push(`## 用户粘贴片段\n${clip(ctx.captureSnippet.trim(), 4000)}`);
  }
  if (ctx.panelDraft?.trim()) {
    parts.push(`## 来自 Capture / 面板的草稿\n${clip(ctx.panelDraft.trim(), 4000)}`);
  }
  return parts.join("\n\n");
}

function contextBlock(ctx: AIChatContext): string {
  const base = contextBlockDocWorkspace(ctx);
  if (!ctx.dialogMessages?.length) return base;
  return `${base}\n\n## 近期对话（节选）\n${formatDialogForAction(ctx.dialogMessages)}`;
}

/**
 * 锚定「产品大脑」：澄清与守护方向，而非代写 PRD、堆功能或内容农场。
 * 英文写 system 便于模型遵守；输出仍要求中文。
 */
const PRODUCT_BRAIN_ANCHOR = [
  "You operate inside AskBible.me Studio: an internal product-brain for calibrating philosophy and direction.",
  "The product is a quiet Bible re-entry (Gentle Return, low cognitive load, companion reading)—not a generic Bible app, tool dashboard, or feature pile.",
  "Do NOT: auto-generate full PRDs, roadmaps, ticket backlogs, or \"build this feature\" plans unless the user explicitly asks for that format.",
  "DO: distill, classify thinking, surface contradictions, flag feature creep / toolification, compress prose, and align stable vocabulary (e.g. Journey, Gentle Return, Reading First, Companion Reading—prefer these over casual synonyms like \"plan\" for ongoing return when it fits).",
  "Respond in concise Chinese unless the pasted material is clearly English-only and Chinese would confuse.",
].join(" ");

const TASK_BY_ACTION: Record<AssistantActionId, string> = {
  studio_chat:
    "Unused: studio_chat uses buildStudioChatMessages (multi-turn).",
  clarify_intent:
    "Task: In concise Chinese, answer what this passage is really trying to resolve or decide (quiet Bible re-entry / product brain, not generic app advice). Then 2–4 numbered next-step thinking directions (map to distill, classify, contradictions, principles, creep, compress, core drift, links, next focus)—not a feature roadmap. If ambiguous, end with ONE clarifying question. No preamble.",
  summarize_insight:
    "Task: Distill into a few sharp bullet insights (core only). No preamble.",
  classify_to_docs:
    "Task: Map input to internal doc themes: Vision, User Psychology, Principles, UX Philosophy, Emotional Design, Journey System, Content Rules, MVP Scope, Dangerous Directions, Parking Lot. Short Chinese bullets, no preamble.",
  detect_contradictions:
    "Task: Surface tensions and whether anything conflicts with principles already implied in the text. Short Chinese bullets. If none, one line.",
  suggest_principle:
    "Task: Judge whether new product principles are warranted; if yes, 1–3 short Chinese imperative lines (principles only, not features). If no, one line why.",
  detect_feature_creep:
    "Task: Check drift toward tool, platform, encyclopedia, chatbot dashboard, or feature pile vs quiet re-entry. Brief Chinese bullets.",
  rewrite_concisely:
    "Task: Rewrite shorter in Chinese: remove AI-ish phrasing and sermon tone; delete fluff; calm voice. No markdown headings unless essential.",
  remind_core_drift:
    "Task: State whether the material drifts from \"重新进入圣经\" (quiet re-entry, gentle return, reading-first). Short Chinese: verdict + 2–4 bullets max.",
  map_product_links:
    "Task: Explicitly relate the material to Journey, Gentle Return, Reading First (and companion reading if relevant). Short Chinese bullets; if a link is weak, say so.",
  suggest_next_focus:
    "Task: What the author should think about next (one priority, optional 1–2 alternates). Concise Chinese; not a build checklist unless they asked for tickets.",
};

/** 将产品动作映射为 system + user（user 含当前文档与 Capture / 草稿） */
export function buildMessagesForAction(
  action: AssistantActionId,
  ctx: AIChatContext,
): { role: "system" | "user" | "assistant"; content: string }[] {
  if (action === "studio_chat") {
    throw new Error("studio_chat must use buildStudioChatMessages");
  }
  const user = contextBlock(ctx);
  const system = `${PRODUCT_BRAIN_ANCHOR}\n\n${TASK_BY_ACTION[action]}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

const STUDIO_CHAT_DIALOG_MAX = 24;

/**
 * 右侧自由对话：system + 工作区上下文 + 多轮 user/assistant。
 */
export function buildStudioChatMessages(
  ctx: AIChatContext,
): { role: "system" | "user" | "assistant"; content: string }[] {
  const dm = ctx.dialogMessages;
  if (!dm?.length) {
    throw new Error("studio_chat requires dialogMessages");
  }
  const last = dm[dm.length - 1];
  if (last.role !== "user") {
    throw new Error("studio_chat last turn must be user");
  }
  const clippedDialog = dm.slice(-STUDIO_CHAT_DIALOG_MAX);
  const workspace = contextBlockDocWorkspace(ctx);
  const system = `${PRODUCT_BRAIN_ANCHOR}

## 当前工作区（仅供参考）
${workspace}

Task (studio chat): Reply in concise Chinese. You are helping the founder use AskBible.me Studio as a product brain—orient, distill, guard scope (quiet Bible re-entry, not tool/chatbot pile). You may briefly suggest which next studio actions could fit (e.g. 理清意图、归类到文档主题、发现矛盾、防功能蔓延…). At most ONE clarifying question. No empty pleasantries.`;

  return [
    { role: "system", content: system },
    ...clippedDialog.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];
}
