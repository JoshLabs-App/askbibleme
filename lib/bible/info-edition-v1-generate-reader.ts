import { gatewaySlotEndpoint } from "@/lib/admin/gateway-slot-endpoints";
import { readAiApiConfigSync, listAllConnectionsPublic } from "@/lib/admin/ai-api-config-store";
import { readGenerationRolesSync, resolveGenerationRole } from "@/lib/admin/generation-roles-store";
import { GENERATION_ROLE_BUILTIN_INFO_V1 } from "@/lib/admin/generation-roles-types";
import { buildInfoEditionV1Messages } from "@/lib/bible/info-edition-v1-prompt";
import {
  INFO_EDITION_V1_PUBLISH_PROFILE_ID,
} from "@/lib/bible/info-edition-v1-publish";
import { publishInfoEditionFromGenerationsAsync } from "@/lib/bible/info-edition-v1-reader-persistence";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";
import { readInfoEditionV1WorkspaceSync } from "@/lib/bible/info-edition-v1-store";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { createChatCompletion } from "@/lib/ai/openai-compatible";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export type GenerateReaderChapterResult =
  | { ok: true; published: InfoEditionV1PublishedChapter }
  | { ok: false; error: string };

const READER_RULES_MAX_CHARS = 2_800;

function readerDescriptionRules(cwd: string): string {
  const ws = readInfoEditionV1WorkspaceSync(cwd);
  const rules = ws.current.descriptionRules?.trim() ?? "";
  if (rules.length <= READER_RULES_MAX_CHARS) return rules;
  return `${rules.slice(0, READER_RULES_MAX_CHARS)}\n\n[…描述规则已截断，以加快生成]`;
}

/** 读经页按需：基础版 × DeepSeek，生成一章并写入发布缓存 */
export async function generateInfoEditionChapterForReader(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<GenerateReaderChapterResult> {
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
  const role = resolveGenerationRole(rolesFile, GENERATION_ROLE_BUILTIN_INFO_V1);
  if (!role) return { ok: false, error: "基础版生成角色不可用。" };

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

  const messages = buildInfoEditionV1Messages(loaded, readerDescriptionRules(cwd), {
    systemPrompt: role.systemPrompt,
  });
  const result = await createChatCompletion(settings, messages, {
    maxTokens: 1_400,
    timeoutMs: 180_000,
  });
  if ("error" in result) return { ok: false, error: result.error };

  const generation: InfoEditionV1Generation = {
    profileId: INFO_EDITION_V1_PUBLISH_PROFILE_ID,
    profileName,
    generationRoleId: role.id,
    generationRoleLabel: role.label,
    text: result.text,
    charCount: result.text.length,
  };

  const published = await publishInfoEditionFromGenerationsAsync(cwd, bookId, chapter, [generation]);
  if (!published) return { ok: false, error: "生成结果无效，无法发布。" };

  return { ok: true, published };
}
