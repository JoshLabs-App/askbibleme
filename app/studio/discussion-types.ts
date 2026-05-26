/**
 * AI Discussion Panel — 消息类型与结构化反思。
 * 真实 AI 接入后仍可沿用同一形状，由 LLM 填充各字段。
 */

import type { StudioDocId } from "@/lib/studio-config";

/** Studio AI 回应节奏：默认 Minimal，避免「AI 教授」式过载 */
export type AIStudioResponseMode = "minimal" | "reflective" | "deep";

/** AI Discussion 角色：不同产品视角（mock / 日后真实 API 共用） */
export const DISCUSSION_ROLE_IDS = [
  "product_partner",
  "gatekeeper",
  "user_lens",
] as const;

export type DiscussionRole = (typeof DISCUSSION_ROLE_IDS)[number];

export function isDiscussionRole(v: string): v is DiscussionRole {
  return (DISCUSSION_ROLE_IDS as readonly string[]).includes(v);
}

/** 单角色：内部 id 固定；显示名与规则可编辑（存 localStorage） */
export type DiscussionRoleConfig = {
  id: DiscussionRole;
  /** 界面与导出 Markdown 中的名称 */
  label: string;
  /** 写给人类与将来 LLM system prompt 的规则全文 */
  rules: string;
};

export const DEFAULT_DISCUSSION_ROLE_CONFIGS: DiscussionRoleConfig[] = [
  {
    id: "product_partner",
    label: "Product Partner",
    rules: [
      "职责：与我讨论产品方向。",
      "先给判断，不做客服式追问；只有必要时再追问。",
      "语气直接、克制、有立场。",
      "Minimal 也不要套固定「核心洞察 / 风险 / 下一步」模板；先回应我当前问题。",
    ].join("\n"),
  },
  {
    id: "gatekeeper",
    label: "Gatekeeper",
    rules: [
      "职责：专门挑刺。",
      "检查是否违背 AskBible.me 核心原则。",
      "检查是否变成工具、平台、百科、游戏化、Dashboard。",
      "提醒功能膨胀、认知负荷、核心偏移。",
    ].join("\n"),
  },
  {
    id: "user_lens",
    label: "User Lens",
    rules: [
      "职责：站在真实用户角度回应。",
      "判断：用户是否会累；是否知道下一步；是否愿意明天回来；是否有安静进入感。",
      "先直接回应问题，避免空泛共情套话。",
    ].join("\n"),
  },
];

/** 与旧代码兼容：label + 一行 hint（取规则首行） */
export const DISCUSSION_ROLE_OPTIONS: {
  id: DiscussionRole;
  label: string;
  hint: string;
}[] = DEFAULT_DISCUSSION_ROLE_CONFIGS.map((c) => ({
  id: c.id,
  label: c.label,
  hint: c.rules.split("\n").find((l) => l.trim().length > 0)?.trim() ?? c.label,
}));

function cloneDefaultRoleConfigs(): DiscussionRoleConfig[] {
  return DEFAULT_DISCUSSION_ROLE_CONFIGS.map((c) => ({ ...c }));
}

/**
 * 合并 localStorage 中的角色配置；未知 id 忽略；缺字段用默认补齐。
 */
export function mergeDiscussionRoleConfigsFromStorage(
  raw: string | null,
): DiscussionRoleConfig[] {
  const base = cloneDefaultRoleConfigs();
  if (!raw?.trim()) return base;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return base;
    for (const row of p) {
      if (!row || typeof row !== "object") continue;
      const id = (row as { id?: unknown }).id;
      if (typeof id !== "string" || !isDiscussionRole(id)) continue;
      const label = (row as { label?: unknown }).label;
      const rules = (row as { rules?: unknown }).rules;
      const idx = base.findIndex((b) => b.id === id);
      if (idx === -1) continue;
      if (typeof label === "string") {
        base[idx] = { ...base[idx], label: label.trim() || base[idx].label };
      }
      if (typeof rules === "string") {
        base[idx] = { ...base[idx], rules };
      }
    }
    return base;
  } catch {
    return base;
  }
}

/**
 * 单次 AI 反思。
 * - partnerReply：用户第一眼看到的回应（自然语言 / Markdown；Minimal 为短答，不强制三段标题）。
 * - coreInsight / tensionRisk / suggestedNextStep：归档与「改写更短」等内部用字段；主卡片只渲染 partnerReply。
 * - responseMode：生成时的模式；缺失时旧消息按 Deep 长文展示兼容。
 */
export type AIReflection = {
  /** 共创层：用户第一眼看到的回应（设计搭档口吻，低认知负荷） */
  partnerReply: string;
  clarifiedIntent: string;
  coreInsight: string;
  /** 可能关联的内置文档 id（Vision … Parking Lot） */
  relatedDocIds: StudioDocId[];
  tensionRisk: string;
  suggestedNextStep: string;
  responseMode?: AIStudioResponseMode;
  /** 讨论角色（默认 Product Partner；旧消息可无此字段） */
  discussionRole?: DiscussionRole;
  /** 生成该条时侧栏中的角色显示名（便于导出与旧消息对稿） */
  discussionRoleLabelSnapshot?: string;
  /** 生成该条时侧栏中的角色规则全文 */
  discussionRoleRulesSnapshot?: string;
};

/** 讨论区 JSON 信封 meta（落盘 / localStorage） */
export type DiscussionEnvelopeMeta = {
  /** 最近一次发送时的选中文档 */
  lastActiveDocId?: StudioDocId;
  /** 最近一次组装上下文检测到的主题标签 */
  lastDetectedTopics?: string[];
  lastRelatedThreadSlugs?: string[];
  /** 启发式关联的正式文档 id */
  lastRelatedDocIds?: StudioDocId[];
  updatedAt?: string;
};

export type DiscussionUserMessage = {
  kind: "user";
  id: string;
  createdAt: string;
  content: string;
  /** 该轮用户发送后由上下文组装写入（可选） */
  meta?: {
    detectedTopics?: string[];
    relatedThreadSlugs?: string[];
    relatedDocIds?: StudioDocId[];
    assembledChars?: number;
  };
};

export type DiscussionAssistantMessage = {
  kind: "assistant";
  id: string;
  createdAt: string;
  reflection: AIReflection;
};

/** 「改写更短」产生的短文本气泡（仍属 AI 侧展示，非用户输入） */
export type DiscussionAssistantNoteMessage = {
  kind: "assistant_note";
  id: string;
  createdAt: string;
  content: string;
};

export type DiscussionMessage =
  | DiscussionUserMessage
  | DiscussionAssistantMessage
  | DiscussionAssistantNoteMessage;
