/**
 * 对外入口：类型、空连接、模板、动作列表。
 * 其它模块应 import 本文件，请求统一走 POST /api/ai/chat。
 */
export type {
  AIChatContext,
  DialogTurn,
  AIChatRequestBody,
  AIConnectionProfile,
  AIProfilesBundle,
  AIProviderId,
  AISettings,
  AssistantActionId,
  ResolvedAISettings,
} from "./types";
export { ASSISTANT_ACTION_IDS, isAssistantActionId } from "./types";
export { emptyConnection, defaultAISettings } from "./defaults";
export { CONNECTION_TEMPLATES, type ConnectionTemplate } from "./presets";
export { STUDIO_ASSISTANT_BUTTONS } from "./assistant-actions";
export { ollamaTagsUrlFromChatBaseUrl } from "./ollama-url";
export {
  getBuiltinPreset,
  getEnvPresetDraft,
  KNOWN_PRESET_CODES,
  normalizePresetCode,
  type PresetDraft,
} from "./preset-code";
export {
  AI_PROFILES_STORAGE_KEY,
  AI_SETTINGS_LEGACY_KEY,
  bundleFromLegacySettingsJson,
  emptyProfilesBundle,
  newProfileId,
} from "./storage";
