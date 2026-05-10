import type { AISettings } from "./types";

/**
 * 空白连接：不预设任何云或本地地址，避免「默认就是 OpenAI」的暗示。
 * 用户通过「连接配置」列表或环境变量填入。
 */
export function emptyConnection(): AISettings {
  return {
    provider: "openai-compatible",
    baseUrl: "",
    model: "",
    apiKey: "",
  };
}

/** @deprecated 使用 emptyConnection；保留别名以免旧 import 断裂 */
export const defaultAISettings = emptyConnection;
