import type { Messages } from "@/lib/i18n/messages";

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur !== null && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * `a.b.c` 点路径。先查 `messages`，再依次查 `fallbackChain`；皆无或非空字符串时回退为 `path` 便于发现漏翻。
 * 当前仅维护 zh-CN / en：中文界面缺键用英文补，英文界面缺键用中文补；将来新增语言时在调用处把英文包放进 fallbacks 前列即可。
 */
export function translate(
  messages: Messages,
  path: string,
  vars?: Record<string, string>,
  fallbackChain: Messages[] = [],
): string {
  for (const bundle of [messages, ...fallbackChain]) {
    const v = getByPath(bundle, path);
    if (typeof v === "string" && v.length > 0) return interpolate(v, vars);
  }
  return path;
}
