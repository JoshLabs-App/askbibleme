/**
 * 快捷码 → 一条连接草稿（不含 id）。
 * 自定义码（如 SKY）走服务端环境变量 AI_PRESET_<CODE>_BASE_URL 等，见 .env.example。
 */
export type PresetDraft = {
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** 为 true 时 Studio 会在应用后自动扫描并一键绑定本机模型 */
  autoScan: boolean;
};

const BUILTIN: Record<string, PresetDraft> = {
  OLLAMA: {
    name: "本机 Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "",
    autoScan: true,
  },
  LOCAL: {
    name: "本机 Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "",
    autoScan: true,
  },
  LM: {
    name: "本机 LM Studio",
    baseUrl: "http://localhost:1234/v1",
    model: "",
    autoScan: true,
  },
  LMSTUDIO: {
    name: "本机 LM Studio",
    baseUrl: "http://localhost:1234/v1",
    model: "",
    autoScan: true,
  },
  VLLM: {
    name: "本机 vLLM",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "",
    autoScan: true,
  },
  LLAMACPP: {
    name: "llama.cpp server",
    baseUrl: "http://127.0.0.1:8080/v1",
    model: "",
    autoScan: true,
  },
};

/** 文档与 UI 提示用 */
export const KNOWN_PRESET_CODES = Object.keys(BUILTIN);

export function normalizePresetCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getBuiltinPreset(code: string): PresetDraft | null {
  const c = normalizePresetCode(code);
  return BUILTIN[c] ?? null;
}

/**
 * 从环境变量读取 AI_PRESET_<CODE>_BASE_URL / NAME / MODEL / API_KEY / AUTO_SCAN
 * CODE 须为 A–Z0–9（如 SKY）。
 */
export function getEnvPresetDraft(code: string): PresetDraft | null {
  const c = normalizePresetCode(code);
  if (!c) return null;
  const prefix = `AI_PRESET_${c}_`;
  const baseUrl = process.env[`${prefix}BASE_URL`]?.trim();
  if (!baseUrl) return null;
  const name =
    process.env[`${prefix}NAME`]?.trim() || `${c} 预设网关`;
  const model = process.env[`${prefix}MODEL`]?.trim() || "";
  const apiKey =
    process.env[`${prefix}API_KEY`]?.trim() ||
    process.env[`${prefix}BEARER`]?.trim();
  const autoRaw = process.env[`${prefix}AUTO_SCAN`]?.trim().toLowerCase();
  const autoScan = autoRaw === "1" || autoRaw === "true" || autoRaw === "yes";
  return { name, baseUrl, model, apiKey, autoScan };
}
