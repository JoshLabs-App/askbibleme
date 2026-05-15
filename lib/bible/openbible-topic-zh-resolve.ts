import fs from "node:fs";
import path from "node:path";
import {
  composeOpenbibleTopicZhFromParts,
  normalizeOpenbibleTopicKey,
  OPENBIBLE_TOPIC_ZH_HANDBOOK,
} from "@/lib/bible/openbible-topic-zh-handbook";

let overridesCache: { path: string; mtimeMs: number; map: Record<string, string> } | null = null;

/**
 * 读取 `data/bible/openbible-topic-zh.json`（可选）。结果按 mtime 缓存；列表接口应对每个请求先调用一次，再传入 {@link resolveOpenbibleTopicZh} 的 `overrides` 参数，避免对每行重复 stat。
 */
export function readOpenbibleTopicZhOverridesMap(cwd: string): Record<string, string> {
  const abs = path.join(cwd, "data/bible/openbible-topic-zh.json");
  try {
    const st = fs.statSync(abs);
    if (overridesCache && overridesCache.path === abs && overridesCache.mtimeMs === st.mtimeMs) {
      return overridesCache.map;
    }
    const raw = JSON.parse(fs.readFileSync(abs, "utf-8")) as Record<string, unknown>;
    const map: Record<string, string> = {};
    for (const [ke, va] of Object.entries(raw)) {
      if (typeof va === "string" && va.trim()) {
        map[normalizeOpenbibleTopicKey(ke)] = va.trim();
      }
    }
    overridesCache = { path: abs, mtimeMs: st.mtimeMs, map };
    return map;
  } catch {
    overridesCache = null;
    return {};
  }
}

/**
 * 返回中文主题（若有）；否则返回 null（界面应回退显示英文）。
 * @param overrides 若已由 {@link readOpenbibleTopicZhOverridesMap} 预加载，传入可避免对同一请求内数千次解析重复读盘。
 */
export function resolveOpenbibleTopicZh(
  cwd: string,
  topic: string,
  overrides?: Record<string, string> | null,
): string | null {
  const k = normalizeOpenbibleTopicKey(topic);
  if (!k) return null;
  const ov = (overrides ?? readOpenbibleTopicZhOverridesMap(cwd))[k];
  if (ov) return ov;
  const hb = OPENBIBLE_TOPIC_ZH_HANDBOOK[k];
  if (hb) return hb;
  return composeOpenbibleTopicZhFromParts(topic);
}
