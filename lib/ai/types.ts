/**
 * 共享 AI 配置类型：Studio 与未来 App 共用。
 * ---------------------------------------------------------------------------
 * 协议：OpenAI 兼容的 `POST {baseUrl}/chat/completions`（Ollama、LM Studio、
 * vLLM、多数云网关均兼容）。产品不绑定某一云品牌，只消费「你填的连接」。
 */

/** 目前仅实现 openai-compatible；预留便于以后扩展其它协议 */
export type AIProviderId = "openai-compatible";

/** 一次实际调用所需的连接参数（无展示名；可由「连接配置」脱壳得到） */
export type AISettings = {
  provider: AIProviderId;
  /** 不含尾部斜杠，例如 http://127.0.0.1:11434/v1 */
  baseUrl: string;
  model: string;
  /** 本地推理常为可选；若为空且环境变量也未提供，则不发送 Authorization */
  apiKey?: string;
};

/** 一条可保存、可选择的连接（通用：其它模块只传 id 或整对象均可） */
export type AIConnectionProfile = AISettings & {
  id: string;
  /** 列表与下拉展示用，例如「本机 Ollama · qwen2.5」 */
  name: string;
};

/** 持久化多组配置时的推荐结构（localStorage / 日后数据库） */
export type AIProfilesBundle = {
  version: 1;
  activeProfileId: string | null;
  profiles: AIConnectionProfile[];
};

/** 已解析、可向上游发起请求（baseUrl / model 必填；apiKey 可选） */
export type ResolvedAISettings = AISettings & {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

/** 与 POST /api/ai/chat 对齐的请求体 */
export type AIChatRequestBody = {
  action: AssistantActionId;
  context: AIChatContext;
  /** 当前选中的连接；其它调用方也可只依赖环境变量 */
  settings?: Partial<AISettings>;
};

/** 右侧 Studio 对话的一条（不含前端专用 id） */
export type DialogTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AIChatContext = {
  docTitle: string;
  docBody: string;
  captureSnippet?: string;
  panelDraft?: string;
  /** studio_chat 必填；协作动作可选附带，便于模型理解刚才聊过什么 */
  dialogMessages?: DialogTurn[];
};

export const ASSISTANT_ACTION_IDS = [
  "studio_chat",
  "clarify_intent",
  "summarize_insight",
  "classify_to_docs",
  "detect_contradictions",
  "suggest_principle",
  "detect_feature_creep",
  "rewrite_concisely",
  "remind_core_drift",
  "map_product_links",
  "suggest_next_focus",
] as const;

export type AssistantActionId = (typeof ASSISTANT_ACTION_IDS)[number];

export function isAssistantActionId(v: string): v is AssistantActionId {
  return (ASSISTANT_ACTION_IDS as readonly string[]).includes(v);
}
