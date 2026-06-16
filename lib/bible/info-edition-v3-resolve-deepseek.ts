import "server-only";

import { gatewaySlotEndpoint } from "@/lib/admin/gateway-slot-endpoints";
import { listAllConnectionsPublic, readAiApiConfigSync } from "@/lib/admin/ai-api-config-store";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import type { ResolvedAISettings } from "@/lib/ai/types";
import { INFO_EDITION_V1_PUBLISH_PROFILE_ID } from "@/lib/bible/info-edition-v1-publish";
import type { CritiqueProfile } from "@/lib/bible/info-edition-v3-run-correction";

export type ResolvedV3DeepSeek = {
  profile: CritiqueProfile;
  settings: ResolvedAISettings;
};

/** V3 纠错流程固定使用 DeepSeek（slot:deepseek）。 */
export function resolveInfoEditionV3DeepSeek(cwd: string): ResolvedV3DeepSeek | { error: string } {
  const connections = listAllConnectionsPublic(readAiApiConfigSync(cwd));
  const conn = connections.find((c) => c.id === INFO_EDITION_V1_PUBLISH_PROFILE_ID);
  const deepseekSlot = gatewaySlotEndpoint("deepseek");
  const baseUrl = conn?.baseUrl.trim() || deepseekSlot?.baseUrl || "";
  const model = conn?.model.trim() || deepseekSlot?.model || "";
  const profileName = conn?.name || deepseekSlot?.shortLabel || "DeepSeek";

  if (!baseUrl || !model) {
    return {
      error: "DeepSeek 未配置：请在后台「API 密钥」启用，或设置环境变量 AI_BASE_URL / AI_MODEL。",
    };
  }

  const settings = resolveAISettings(
    { provider: "openai-compatible", baseUrl, model },
    { profileId: INFO_EDITION_V1_PUBLISH_PROFILE_ID },
  );
  if ("error" in settings) return { error: settings.error };
  if (!settings.apiKey?.trim()) {
    return {
      error: "未配置 DeepSeek API Key：请在后台「API 密钥」填写，或设置环境变量 AI_API_KEY。",
    };
  }

  return {
    profile: {
      id: INFO_EDITION_V1_PUBLISH_PROFILE_ID,
      name: profileName,
      settings: {
        provider: "openai-compatible",
        baseUrl,
        model,
        apiKey: settings.apiKey,
      },
    },
    settings,
  };
}
