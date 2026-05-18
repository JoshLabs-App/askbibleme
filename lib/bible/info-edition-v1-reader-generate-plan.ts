import "server-only";

import { gatewaySlotEndpoint } from "@/lib/admin/gateway-slot-endpoints";
import { readAiApiConfigSync, listAllConnectionsPublic } from "@/lib/admin/ai-api-config-store";
import { readGenerationRolesSync, resolveGenerationRole } from "@/lib/admin/generation-roles-store";
import type { GenerationRole } from "@/lib/admin/generation-roles-types";
import { buildInfoEditionV1Messages } from "@/lib/bible/info-edition-v1-prompt";
import {
  INFO_EDITION_V1_PUBLISH_PROFILE_ID,
  readerVariantFromRole,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import {
  publishInfoEditionFromGenerationsAsync,
  type ResolvedInfoEditionReaderTarget,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";
import { readInfoEditionV1WorkspaceSync } from "@/lib/bible/info-edition-v1-store";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import type { LoadedChapter } from "@/lib/bible/load-chapter-from-default-translation";
import { createChatCompletion } from "@/lib/ai/openai-compatible";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import type { ResolvedAISettings } from "@/lib/ai/types";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export const READER_DESCRIPTION_RULES_MAX_CHARS = 2_800;

export type InfoEditionReaderGeneratePlan = {
  target: ResolvedInfoEditionReaderTarget;
  variant: InfoEditionReaderVariant;
  role: GenerationRole;
  loaded: LoadedChapter;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  descriptionRulesUsed: string;
  settings: ResolvedAISettings;
  profileId: string;
  profileName: string;
  maxTokens: number;
  timeoutMs: number;
};

export type PlanReaderGenerationResult =
  | { ok: true; plan: InfoEditionReaderGeneratePlan }
  | { ok: false; error: string };

export type ExecuteReaderGenerationResult =
  | {
      ok: true;
      plan: InfoEditionReaderGeneratePlan;
      generation: InfoEditionV1Generation;
      published: InfoEditionV1PublishedChapter | null;
    }
  | { ok: false; error: string; plan?: InfoEditionReaderGeneratePlan };

function clipDescriptionRules(rules: string): string {
  const trimmed = rules.trim();
  if (trimmed.length <= READER_DESCRIPTION_RULES_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, READER_DESCRIPTION_RULES_MAX_CHARS)}\n\n[…描述规则已截断，以加快生成]`;
}

export function readerDescriptionRulesFromWorkspace(cwd: string): string {
  const ws = readInfoEditionV1WorkspaceSync(cwd);
  return clipDescriptionRules(ws.current.descriptionRules ?? "");
}

export function resolveReaderDescriptionRules(
  cwd: string,
  variant: InfoEditionReaderVariant,
  override?: string | null,
): string {
  if (variant === "guide") return "";
  if (override !== undefined && override !== null) {
    return clipDescriptionRules(override);
  }
  return readerDescriptionRulesFromWorkspace(cwd);
}

/** 与读经页 POST 相同：拼好 system / user、DeepSeek 连接（不调用模型） */
export async function planInfoEditionReaderGeneration(
  cwd: string,
  bookId: string,
  chapter: number,
  target: ResolvedInfoEditionReaderTarget,
  opts?: { descriptionRulesOverride?: string | null },
): Promise<PlanReaderGenerationResult> {
  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return { ok: false, error: "无效书卷。" };
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return { ok: false, error: "无效章号。" };
  }

  const loaded = await loadChapterFromDefaultTranslation(bookId, chapter);
  if (!loaded) {
    return { ok: false, error: "无法读取本章经文。请先在后台登记默认译本。" };
  }

  const rolesFile = readGenerationRolesSync(cwd);
  const role = resolveGenerationRole(rolesFile, target.roleId);
  if (!role) {
    return {
      ok: false,
      error: target.variant === "guide" ? "发现版生成角色不可用。" : "讲解版生成角色不可用。",
    };
  }
  const roleVariant = readerVariantFromRole(role);
  if (roleVariant !== target.variant) {
    return {
      ok: false,
      error: `角色「${role.label}」与版本 ${target.variant === "guide" ? "发现版" : "讲解版"} 不一致。`,
    };
  }

  const connections = listAllConnectionsPublic(readAiApiConfigSync(cwd));
  const conn = connections.find((c) => c.id === INFO_EDITION_V1_PUBLISH_PROFILE_ID);
  const deepseekSlot = gatewaySlotEndpoint("deepseek");
  const baseUrl = conn?.baseUrl.trim() || deepseekSlot?.baseUrl || "";
  const model = conn?.model.trim() || deepseekSlot?.model || "";
  const profileName = conn?.name || deepseekSlot?.shortLabel || "DeepSeek";
  if (!baseUrl || !model) {
    return {
      ok: false,
      error: "DeepSeek 未配置：请在后台「API 密钥」启用，或设置环境变量 AI_BASE_URL / AI_MODEL / AI_API_KEY。",
    };
  }

  const settings = resolveAISettings(
    {
      provider: "openai-compatible",
      baseUrl,
      model,
    },
    { profileId: INFO_EDITION_V1_PUBLISH_PROFILE_ID },
  );
  if ("error" in settings) return { ok: false, error: settings.error };
  if (!settings.apiKey?.trim()) {
    return {
      ok: false,
      error: "未配置 DeepSeek API Key：请在后台「API 密钥」填写，或设置环境变量 AI_API_KEY。",
    };
  }

  const descriptionRulesUsed = resolveReaderDescriptionRules(
    cwd,
    target.variant,
    opts?.descriptionRulesOverride,
  );
  const messages = buildInfoEditionV1Messages(loaded, descriptionRulesUsed, {
    systemPrompt: role.systemPrompt,
    variant: target.variant,
  });

  return {
    ok: true,
    plan: {
      target,
      variant: target.variant,
      role,
      loaded,
      messages,
      descriptionRulesUsed,
      settings,
      profileId: INFO_EDITION_V1_PUBLISH_PROFILE_ID,
      profileName,
      maxTokens: 1_400,
      timeoutMs: 180_000,
    },
  };
}

export function planToPublicPayload(plan: InfoEditionReaderGeneratePlan) {
  return {
    variant: plan.variant,
    variantLabel: plan.role.label,
    editionKind: plan.variant === "guide" ? "发现版" : "讲解版",
    roleId: plan.role.id,
    roleLabel: plan.role.label,
    roleHint: plan.role.hint,
    bookId: plan.loaded.bookId,
    bookName: plan.loaded.bookName,
    chapter: plan.loaded.chapter,
    translation: plan.loaded.labelZh || plan.loaded.translationId,
    descriptionRulesUsed: plan.descriptionRulesUsed,
    descriptionRulesCharCount: plan.descriptionRulesUsed.length,
    profileId: plan.profileId,
    profileName: plan.profileName,
    model: plan.settings.model,
    baseUrl: plan.settings.baseUrl,
    maxTokens: plan.maxTokens,
    timeoutMs: plan.timeoutMs,
    messages: plan.messages,
    systemCharCount: plan.messages.find((m) => m.role === "system")?.content.length ?? 0,
    userCharCount: plan.messages.find((m) => m.role === "user")?.content.length ?? 0,
  };
}

/** 执行模型调用；可选写入与读经页相同的发布缓存 */
export async function executeInfoEditionReaderPlan(
  cwd: string,
  bookId: string,
  chapter: number,
  plan: InfoEditionReaderGeneratePlan,
  opts?: { publish?: boolean },
): Promise<ExecuteReaderGenerationResult> {
  const result = await createChatCompletion(plan.settings, plan.messages, {
    maxTokens: plan.maxTokens,
    timeoutMs: plan.timeoutMs,
  });
  if ("error" in result) {
    return { ok: false, error: result.error, plan };
  }

  const generation: InfoEditionV1Generation = {
    profileId: plan.profileId,
    profileName: plan.profileName,
    generationRoleId: plan.role.id,
    generationRoleLabel: plan.role.label,
    text: result.text,
    charCount: result.text.length,
  };

  let published: InfoEditionV1PublishedChapter | null = null;
  if (opts?.publish) {
    published = await publishInfoEditionFromGenerationsAsync(
      cwd,
      bookId,
      chapter,
      [generation],
      plan.target,
    );
    if (!published) {
      return { ok: false, error: "生成结果无效，无法写入发布缓存。", plan };
    }
  }

  return { ok: true, plan, generation, published };
}
