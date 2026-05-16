import "server-only";
import fs from "node:fs";
import path from "node:path";
import { gatewaySlotEndpoint } from "@/lib/admin/gateway-slot-endpoints";
import { dedupeByEndpoint, profileSizeGbLabel, profileSuitabilityHint } from "@/lib/ai/profile-display";
import {
  AI_API_CONFIG_MASK,
  AI_API_CONFIG_VERSION,
  type AiApiConfigFile,
  type AiApiConfigPublic,
  type AiApiConfigSlot,
  type AiApiConfigSlotPublic,
  type StudioConnectionMeta,
  type StudioConnectionPublic,
} from "@/lib/admin/ai-api-config-types";

const REL = path.join("data", "admin", "ai-api-config.json");

const DEFAULT_SLOTS: Omit<AiApiConfigSlot, "apiKey">[] = [
  { id: "openai", label: "OpenAI", hostContains: "api.openai.com", enabled: true },
  { id: "deepseek", label: "DeepSeek", hostContains: "api.deepseek.com", enabled: true },
  { id: "moonshot", label: "Moonshot", hostContains: "api.moonshot.cn", enabled: true },
  { id: "zhipu", label: "智谱", hostContains: "open.bigmodel.cn", enabled: true },
  { id: "siliconflow", label: "SiliconFlow", hostContains: "siliconflow.cn", enabled: true },
  { id: "azure", label: "Azure OpenAI", hostContains: "openai.azure.com", enabled: true },
];

function absPath(cwd: string): string {
  return path.join(cwd, REL);
}

function defaultFile(): AiApiConfigFile {
  return {
    version: AI_API_CONFIG_VERSION,
    slots: DEFAULT_SLOTS.map((s) => ({ ...s, apiKey: "" })),
    profileKeys: {},
    studioConnections: [],
  };
}

function normalizeConnection(raw: unknown): StudioConnectionMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
  const model = typeof o.model === "string" ? o.model.trim() : "";
  const syncedAt = typeof o.syncedAt === "string" ? o.syncedAt : "";
  if (!id || !baseUrl) return null;
  return {
    id,
    name: name || id,
    baseUrl,
    model,
    syncedAt: syncedAt || new Date().toISOString(),
  };
}

export function connectionsToPublic(
  connections: StudioConnectionMeta[],
  profileKeys: Record<string, string>,
  opts?: { source?: "studio" | "gateway"; forceHasKey?: boolean },
): StudioConnectionPublic[] {
  return connections.map((c) => ({
    ...c,
    hasKey: opts?.forceHasKey ?? Boolean(profileKeys[c.id]?.trim()),
    source: opts?.source,
    sizeGb: profileSizeGbLabel(c),
    suitabilityHint: profileSuitabilityHint(c) || null,
  }));
}

/** 已在后台配置密钥的网关（OpenAI / DeepSeek 等）→ 可加入 V1 多选 */
export function buildGatewayConnections(file: AiApiConfigFile): StudioConnectionMeta[] {
  const syncedAt = new Date().toISOString();
  const out: StudioConnectionMeta[] = [];
  for (const slot of file.slots) {
    if (!slot.enabled || !slot.apiKey.trim()) continue;
    const def = gatewaySlotEndpoint(slot.id);
    const baseUrl = (slot.baseUrl?.trim() || def?.baseUrl || "").replace(/\/$/, "");
    const model = slot.model?.trim() || def?.model || "";
    if (!baseUrl || !model) continue;
    const short = def?.shortLabel || slot.label;
    out.push({
      id: `slot:${slot.id}`,
      name: short,
      baseUrl,
      model,
      syncedAt,
    });
  }
  return out;
}

export function listAllConnectionsPublic(file: AiApiConfigFile): StudioConnectionPublic[] {
  const gateway = buildGatewayConnections(file);
  const gatewayPublic = connectionsToPublic(gateway, file.profileKeys, {
    source: "gateway",
    forceHasKey: true,
  });
  const studioPublic = connectionsToPublic(file.studioConnections, file.profileKeys, {
    source: "studio",
  });
  return dedupeByEndpoint([...gatewayPublic, ...studioPublic]);
}

function maskKey(key: string): string | null {
  const k = key.trim();
  if (!k) return null;
  if (k.length <= 8) return AI_API_CONFIG_MASK;
  return `${AI_API_CONFIG_MASK}${k.slice(-4)}`;
}

export function toPublicConfig(file: AiApiConfigFile): AiApiConfigPublic {
  const slots: AiApiConfigSlotPublic[] = file.slots.map((s) => ({
    id: s.id,
    label: s.label,
    hostContains: s.hostContains,
    enabled: s.enabled,
    hasKey: Boolean(s.apiKey.trim()),
    maskedKey: maskKey(s.apiKey),
  }));
  const profileKeys: AiApiConfigPublic["profileKeys"] = {};
  for (const [id, key] of Object.entries(file.profileKeys)) {
    const k = String(key ?? "").trim();
    profileKeys[id] = { hasKey: Boolean(k), maskedKey: maskKey(k) };
  }
  const studioConnections = file.studioConnections ?? [];
  let connectionsSyncedAt: string | null = null;
  for (const c of studioConnections) {
    if (c.syncedAt && (!connectionsSyncedAt || c.syncedAt > connectionsSyncedAt)) {
      connectionsSyncedAt = c.syncedAt;
    }
  }
  return {
    version: AI_API_CONFIG_VERSION,
    slots,
    profileKeys,
    studioConnections: listAllConnectionsPublic(file),
    connectionsSyncedAt,
  };
}

function normalizeSlot(raw: unknown): AiApiConfigSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const label = typeof o.label === "string" ? o.label.trim() : "";
  const hostContains = typeof o.hostContains === "string" ? o.hostContains.trim().toLowerCase() : "";
  if (!id || !label) return null;
  const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : undefined;
  const model = typeof o.model === "string" ? o.model.trim() : undefined;
  return {
    id,
    label,
    hostContains,
    apiKey: typeof o.apiKey === "string" ? o.apiKey : "",
    enabled: o.enabled !== false,
    ...(baseUrl ? { baseUrl } : {}),
    ...(model ? { model } : {}),
  };
}

function normalizeFile(raw: unknown): AiApiConfigFile {
  if (!raw || typeof raw !== "object") return defaultFile();
  const o = raw as Record<string, unknown>;
  const slotsRaw = Array.isArray(o.slots) ? o.slots : [];
  const parsed = slotsRaw.map(normalizeSlot).filter((x): x is AiApiConfigSlot => x !== null);
  const byId = new Map<string, AiApiConfigSlot>();
  for (const s of defaultFile().slots) byId.set(s.id, { ...s });
  for (const s of parsed) byId.set(s.id, s);

  const profileKeys: Record<string, string> = {};
  if (o.profileKeys && typeof o.profileKeys === "object" && !Array.isArray(o.profileKeys)) {
    for (const [k, v] of Object.entries(o.profileKeys as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) profileKeys[k.trim()] = v;
    }
  }

  const studioRaw = Array.isArray(o.studioConnections) ? o.studioConnections : [];
  const studioConnections = studioRaw
    .map(normalizeConnection)
    .filter((x): x is StudioConnectionMeta => x !== null);

  return {
    version: AI_API_CONFIG_VERSION,
    slots: [...byId.values()],
    profileKeys,
    studioConnections,
  };
}

export function writeStudioConnectionsSync(
  cwd: string,
  connections: Omit<StudioConnectionMeta, "syncedAt">[],
): AiApiConfigFile {
  const prev = readAiApiConfigSync(cwd);
  const now = new Date().toISOString();
  const studioConnections: StudioConnectionMeta[] = dedupeByEndpoint(
    connections
      .map((c) => ({
        id: c.id.trim(),
        name: c.name.trim() || c.id,
        baseUrl: c.baseUrl.trim(),
        model: c.model.trim(),
      }))
      .filter((c) => c.id && c.baseUrl),
  ).map((c) => ({
    ...c,
    syncedAt: now,
  }));
  const next: AiApiConfigFile = { ...prev, studioConnections };
  writeAiApiConfigSync(cwd, next);
  return next;
}

export function readAiApiConfigSync(cwd: string): AiApiConfigFile {
  const file = absPath(cwd);
  if (!fs.existsSync(file)) return defaultFile();
  try {
    return normalizeFile(JSON.parse(fs.readFileSync(file, "utf8")) as unknown);
  } catch {
    return defaultFile();
  }
}

export function writeAiApiConfigSync(cwd: string, next: AiApiConfigFile): void {
  const file = absPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const normalized = normalizeFile(next);
  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function newAiApiSlotId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const AI_API_CONFIG_REL = REL;
