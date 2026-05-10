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

/** `a.b.c` 点路径；缺键时回退为 `path` 便于发现漏翻 */
export function translate(
  messages: Messages,
  path: string,
  vars?: Record<string, string>,
): string {
  const v = getByPath(messages, path);
  if (typeof v !== "string") return path;
  return interpolate(v, vars);
}
