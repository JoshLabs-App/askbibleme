export const AI_API_CONFIG_VERSION = 1 as const;

/** 后台 GET 脱敏占位；客户端表单勿改此值即表示保留原密钥 */
export const AI_API_CONFIG_MASK = "••••••••";

/** 按 Base URL 子串匹配并注入 Bearer */
export type AiApiConfigSlot = {
  id: string;
  label: string;
  /** baseUrl 转小写后包含此片段即命中（空则永不匹配） */
  hostContains: string;
  apiKey: string;
  enabled: boolean;
  /** 可选覆盖默认可调用端点（自定义网关） */
  baseUrl?: string;
  model?: string;
};

/** Studio 同步的连接元数据（无密钥；由浏览器上报后供各后台页读取） */
export type StudioConnectionMeta = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  syncedAt: string;
};

export type AiApiConfigFile = {
  version: typeof AI_API_CONFIG_VERSION;
  slots: AiApiConfigSlot[];
  /** Studio 连接 profile id → 密钥（优先于 host 匹配） */
  profileKeys: Record<string, string>;
  /** 最近一次从 Studio localStorage 同步的连接列表 */
  studioConnections: StudioConnectionMeta[];
};

export type AiApiConfigSlotPublic = Omit<AiApiConfigSlot, "apiKey"> & {
  hasKey: boolean;
  maskedKey: string | null;
};

export type StudioConnectionPublic = StudioConnectionMeta & {
  hasKey: boolean;
  /** studio = Studio 同步；gateway = 后台 API 密钥页 */
  source?: "studio" | "gateway";
  /** 从 name 解析，如 约8.4G；云端网关通常无 */
  sizeGb?: string | null;
  /** 从 name 或网关预设解析的一句话场景说明 */
  suitabilityHint?: string | null;
};

export type AiApiConfigPublic = {
  version: typeof AI_API_CONFIG_VERSION;
  slots: AiApiConfigSlotPublic[];
  profileKeys: Record<string, { hasKey: boolean; maskedKey: string | null }>;
  studioConnections: StudioConnectionPublic[];
  connectionsSyncedAt: string | null;
};
