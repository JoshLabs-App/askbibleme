/**
 * Ollama 的模型列表在 /api/tags；用户表单里常填 OpenAI 兼容的 …/v1。
 * 从 chat Base URL 推导出可请求 tags 的根地址。
 */
export function ollamaTagsUrlFromChatBaseUrl(chatBaseUrl: string): string {
  let root = chatBaseUrl.trim().replace(/\/$/, "");
  if (root.endsWith("/v1")) {
    root = root.slice(0, -3);
  }
  return `${root}/api/tags`;
}
