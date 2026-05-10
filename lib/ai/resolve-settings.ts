import type { AISettings, ResolvedAISettings } from "./types";

/**
 * 合并：请求体里的 settings + 环境变量（CI/部署用）。
 * - baseUrl / model 必填（可由请求体或环境变量提供）。
 * - apiKey 可选：本地 Ollama 等常不需要；若需要，来自请求体或 AI_API_KEY 等。
 */
export function resolveAISettings(
  partial?: Partial<AISettings>,
): ResolvedAISettings | { error: string } {
  const baseUrlRaw =
    partial?.baseUrl?.trim() || process.env.AI_BASE_URL?.trim() || "";
  if (!baseUrlRaw) {
    return {
      error:
        "未填写 Base URL：请在「连接配置」中选择或新建一条，并填写端点（含 /v1）；也可在环境变量 AI_BASE_URL 中设置。",
    };
  }
  const baseUrl = baseUrlRaw.replace(/\/$/, "");

  const model =
    partial?.model?.trim() || process.env.AI_MODEL?.trim() || "";
  if (!model) {
    return {
      error:
        "未填写模型名：请在配置中填写 model（或环境变量 AI_MODEL）。本地服务请填你实际加载的模型 id。",
    };
  }

  const provider = partial?.provider ?? "openai-compatible";

  const fromBody = partial?.apiKey?.trim();
  const fromEnv =
    process.env.AI_API_KEY?.trim() ||
    process.env.AI_BEARER_TOKEN?.trim() ||
    process.env.OPENAI_API_KEY?.trim();

  const apiKey = fromBody || fromEnv || undefined;

  return {
    provider,
    baseUrl,
    model,
    apiKey,
  };
}
