/** 去掉模型偶尔包裹的代码块，便于 Markdown 渲染 */
export function normalizeInfoEditionCompareMarkdown(raw: string): string {
  let text = raw.trim();
  const fence = /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/i;
  const m = text.match(fence);
  if (m) text = m[1].trim();
  return text;
}
