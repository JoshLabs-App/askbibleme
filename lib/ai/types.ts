/**
 * 共享 AI 连接类型：供后台网关与内容批处理脚本使用。
 * ---------------------------------------------------------------------------
 * 协议：OpenAI 兼容的 `POST {baseUrl}/chat/completions`（Ollama、LM Studio、
 * vLLM、多数云网关均兼容）。
 */

/** 目前仅实现 openai-compatible；预留便于以后扩展其它协议 */
export type AIProviderId = "openai-compatible";

/** 一次实际调用所需的连接参数 */
export type AISettings = {
  provider: AIProviderId;
  /** 不含尾部斜杠，例如 http://127.0.0.1:11434/v1 */
  baseUrl: string;
  model: string;
  /** 本地推理常为可选；若为空且环境变量也未提供，则不发送 Authorization */
  apiKey?: string;
};

/** 一条可保存、可选择的连接 */
export type AIConnectionProfile = AISettings & {
  id: string;
  /** 列表与下拉展示用，例如「本机 Ollama · qwen2.5」 */
  name: string;
};

/** 已解析、可向上游发起请求（baseUrl / model 必填；apiKey 可选） */
export type ResolvedAISettings = AISettings & {
  baseUrl: string;
  model: string;
  apiKey?: string;
};
