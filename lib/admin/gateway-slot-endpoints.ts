/** 后台「API 密钥」网关槽位 → 默认可调用的 OpenAI 兼容端点（无密钥） */
export type GatewaySlotEndpoint = {
  baseUrl: string;
  model: string;
  /** V1 芯片短名 */
  shortLabel: string;
  /** 一句话：适合什么场景 */
  hint: string;
};

export const GATEWAY_SLOT_ENDPOINTS: Record<string, GatewaySlotEndpoint> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    shortLabel: "GPT",
    hint: "云端通用；日常写作、摘要与中等推理",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    shortLabel: "DeepSeek",
    hint: "性价比高；中文说理与长文草稿",
  },
  moonshot: {
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    shortLabel: "Moonshot",
    hint: "长上下文；资料整理与连贯叙述",
  },
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    shortLabel: "智谱",
    hint: "国内 GLM；快响应对话与轻量任务",
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
    shortLabel: "SiliconFlow",
    hint: "聚合托管；试用大模型或备用线路",
  },
};

export function gatewaySlotEndpoint(slotId: string): GatewaySlotEndpoint | null {
  return GATEWAY_SLOT_ENDPOINTS[slotId] ?? null;
}
