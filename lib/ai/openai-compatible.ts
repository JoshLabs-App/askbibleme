import type { ResolvedAISettings } from "./types";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

/**
 * 调用上游 OpenAI 兼容接口（chat/completions）。
 * 本地服务若无 Key，则不发送 Authorization 头。
 */
export async function createChatCompletion(
  settings: ResolvedAISettings,
  messages: ChatMessage[],
  opts?: { maxTokens?: number; timeoutMs?: number },
): Promise<{ text: string } | { error: string; status?: number }> {
  const url = `${settings.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }

  const timeoutMs = opts?.timeoutMs ?? 0;
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      signal: controller?.signal,
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: 0.35,
        max_tokens: opts?.maxTokens ?? 1800,
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { error: "请求超时，请稍后再试。" };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg || "无法连接 AI 服务。" };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const json = (await res.json()) as ChatCompletionResponse;

  if (!res.ok) {
    const msg =
      json.error?.message ||
      `上游返回 ${res.status}，请检查 Base URL、模型名是否与该服务一致。`;
    return { error: msg, status: res.status };
  }

  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { error: "模型未返回可读文本（choices 为空）。" };
  }
  return { text };
}
