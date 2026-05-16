import "server-only";
import { readAiApiConfigSync } from "@/lib/admin/ai-api-config-store";
import type { AISettings } from "@/lib/ai/types";

export type AiKeySource = "request" | "profile" | "slot" | "env" | "none";

export function resolveAdminKeySource(
  partial: Partial<AISettings>,
  opts?: { profileId?: string; cwd?: string },
): { source: AiKeySource; apiKey?: string } {
  if (partial.apiKey?.trim()) {
    return { source: "request", apiKey: partial.apiKey.trim() };
  }

  const cwd = opts?.cwd ?? process.cwd();
  const file = readAiApiConfigSync(cwd);
  const profileId = opts?.profileId?.trim();

  if (profileId?.startsWith("slot:")) {
    const slotId = profileId.slice("slot:".length);
    const slot = file.slots.find((s) => s.id === slotId && s.enabled);
    if (slot?.apiKey.trim()) {
      return { source: "slot", apiKey: slot.apiKey.trim() };
    }
  }

  if (profileId && file.profileKeys[profileId]?.trim()) {
    return { source: "profile", apiKey: file.profileKeys[profileId].trim() };
  }

  const base = partial.baseUrl?.trim().toLowerCase();
  if (base) {
    for (const slot of file.slots) {
      if (!slot.enabled) continue;
      const needle = slot.hostContains.trim().toLowerCase();
      if (!needle || !slot.apiKey.trim()) continue;
      if (base.includes(needle)) {
        return { source: "slot", apiKey: slot.apiKey.trim() };
      }
    }
  }

  const fromEnv =
    process.env.AI_API_KEY?.trim() ||
    process.env.AI_BEARER_TOKEN?.trim() ||
    process.env.OPENAI_API_KEY?.trim();

  if (fromEnv) return { source: "env", apiKey: fromEnv };

  return { source: "none" };
}
