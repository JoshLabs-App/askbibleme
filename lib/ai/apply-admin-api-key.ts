import "server-only";
import { readAiApiConfigSync } from "@/lib/admin/ai-api-config-store";
import type { AISettings } from "@/lib/ai/types";

/**
 * 将后台 `data/admin/ai-api-config.json` 中的密钥并入连接参数。
 * 优先级：请求体已有 apiKey > profileId 精确映射 > Base URL 匹配槽位 >（再由 resolveAISettings 读环境变量）
 */
export function applyAdminApiKey(
  partial: Partial<AISettings>,
  opts?: { profileId?: string; cwd?: string },
): Partial<AISettings> {
  const fromBody = partial.apiKey?.trim();
  if (fromBody) return partial;

  const cwd = opts?.cwd ?? process.cwd();
  const file = readAiApiConfigSync(cwd);
  const profileId = opts?.profileId?.trim();

  if (profileId?.startsWith("slot:")) {
    const slotId = profileId.slice("slot:".length);
    const slot = file.slots.find((s) => s.id === slotId && s.enabled);
    if (slot?.apiKey.trim()) {
      return { ...partial, apiKey: slot.apiKey.trim() };
    }
  }

  if (profileId && file.profileKeys[profileId]?.trim()) {
    return { ...partial, apiKey: file.profileKeys[profileId].trim() };
  }

  const base = partial.baseUrl?.trim().toLowerCase();
  if (!base) return partial;

  for (const slot of file.slots) {
    if (!slot.enabled) continue;
    const needle = slot.hostContains.trim().toLowerCase();
    if (!needle || !slot.apiKey.trim()) continue;
    if (base.includes(needle)) {
      return { ...partial, apiKey: slot.apiKey.trim() };
    }
  }

  return partial;
}
