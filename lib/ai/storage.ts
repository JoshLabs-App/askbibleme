import type { AIConnectionProfile, AIProfilesBundle, AISettings } from "./types";
import { emptyConnection } from "./defaults";

export const AI_PROFILES_STORAGE_KEY = "askbible-ai-profiles-v2";
/** 旧版单表单存储；首次启动时迁移到多配置 */
export const AI_SETTINGS_LEGACY_KEY = "askbible-ai-settings-v1";

export function newProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyProfilesBundle(): AIProfilesBundle {
  return { version: 1, activeProfileId: null, profiles: [] };
}

/** 将旧版扁平 settings 迁成一条 profile（仅浏览器内执行） */
export function bundleFromLegacySettingsJson(raw: string): AIProfilesBundle | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    const has =
      (parsed.baseUrl && String(parsed.baseUrl).trim()) ||
      (parsed.model && String(parsed.model).trim()) ||
      (parsed.apiKey && String(parsed.apiKey).trim());
    if (!has) return null;
    const id = newProfileId();
    const profile: AIConnectionProfile = {
      id,
      name: "迁移自旧版配置",
      provider: parsed.provider ?? "openai-compatible",
      baseUrl: String(parsed.baseUrl ?? "").trim(),
      model: String(parsed.model ?? "").trim(),
      apiKey: parsed.apiKey?.trim() || undefined,
    };
    return { version: 1, activeProfileId: id, profiles: [profile] };
  } catch {
    return null;
  }
}
