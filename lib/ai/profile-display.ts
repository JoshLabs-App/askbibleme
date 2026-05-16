import type { AIConnectionProfile } from "@/lib/ai/types";
import { gatewaySlotEndpoint } from "@/lib/admin/gateway-slot-endpoints";

/** 芯片 / 列表用短名（偏短；多栏对比请用 profileChipLabel） */
export function profileShortName(p: Pick<AIConnectionProfile, "name" | "model">): string {
  const name = p.name.trim();
  if (name.length > 0 && name.length <= 10) return name;
  const model = p.model.trim();
  const tail = model.includes("/") ? (model.split("/").pop() ?? model) : model;
  if (tail.length > 0 && tail.length <= 12) return tail;
  if (name.length > 0) return name.slice(0, 8);
  return tail.slice(0, 8) || "AI";
}

function modelTail(model: string): string {
  const m = model.trim();
  if (!m) return "";
  return m.includes("/") ? (m.split("/").pop() ?? m) : m;
}

/** 去重键：同一 baseUrl + model 只保留一条 */
export function profileEndpointKey(p: Pick<AIConnectionProfile, "baseUrl" | "model">): string {
  const url = p.baseUrl.trim().replace(/\/+$/, "").toLowerCase();
  const model = p.model.trim().toLowerCase();
  if (!url && !model) return "";
  return `${url}::${model}`;
}

/** 同 baseUrl+model 去重：保留名称更完整的一条；靠前者优先 */
export function dedupeByEndpoint<T extends { baseUrl: string; model: string; name: string }>(
  items: T[],
): T[] {
  const out: T[] = [];
  const indexByKey = new Map<string, number>();
  for (const p of items) {
    const key = profileEndpointKey(p);
    if (!key || key === "::") {
      out.push(p);
      continue;
    }
    const idx = indexByKey.get(key);
    if (idx === undefined) {
      indexByKey.set(key, out.length);
      out.push(p);
      continue;
    }
    const prev = out[idx];
    if (p.name.trim().length > prev.name.trim().length) out[idx] = p;
  }
  return out;
}

/** 本地/同步连接列表去重 */
export function dedupeConnectionProfiles<T extends AIConnectionProfile>(profiles: T[]): T[] {
  return dedupeByEndpoint(profiles);
}

/** 从连接名解析体量，如「约8.4G」（Studio / Ollama 导入名） */
export function profileSizeGbLabel(p: Pick<AIConnectionProfile, "name">): string | null {
  const name = p.name.trim();
  const m = name.match(/约([\d.]+)\s*G/i);
  if (!m) return null;
  return `约${m[1]}G`;
}

/** 从 Studio 导入名等解析「适合什么」说明 */
export function profileSuitabilityHint(p: Pick<AIConnectionProfile, "id" | "name">): string {
  if (p.id.startsWith("slot:")) {
    const slotId = p.id.slice("slot:".length);
    const def = gatewaySlotEndpoint(slotId);
    return def?.hint ?? "";
  }
  const name = p.name.trim();
  if (!name) return "";
  const colon = name.lastIndexOf("：");
  if (colon >= 0) {
    const tail = name.slice(colon + 1).trim();
    if (tail.length > 2) return tail;
  }
  const segments = name.split(" · ").map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last || /^约[\d.]+G$/i.test(last)) return "";
  if (/^本机|^Ollama|^连接$/i.test(last)) return "";
  if (segments.length >= 2 && segments[segments.length - 2]?.match(/^约[\d.]+G$/i)) return last;
  return "";
}

export type ProfileCompareDisplay = {
  chip: string;
  /** 如 约8.4G；云端网关通常无 */
  sizeGb: string | null;
  hint: string;
  title: string;
};

/** V1 对比页：芯片主标题 + 体量 + 场景说明 */
export function profileCompareDisplay(
  p: AIConnectionProfile,
  all: AIConnectionProfile[],
): ProfileCompareDisplay {
  const chip = profileChipLabel(p, all);
  const sizeGb = profileSizeGbLabel(p);
  const hint = profileSuitabilityHint(p);
  const title = [p.name.trim(), sizeGb, p.model.trim(), p.baseUrl.trim()].filter(Boolean).join("\n");
  return { chip, sizeGb, hint, title };
}

/** 多条连接短名相同时，用主机片段区分 */
export function profileChipLabel(p: AIConnectionProfile, all: AIConnectionProfile[]): string {
  const tail = modelTail(p.model);
  let short = tail ? tail.slice(0, 20) : profileShortName(p);
  if (!short) short = "AI";

  const sameChip = (x: AIConnectionProfile) => {
    const t = modelTail(x.model);
    const s = t ? t.slice(0, 20) : profileShortName(x);
    return s === short;
  };
  const dupes = all.filter(sameChip);
  if (dupes.length <= 1) return short;

  const host = p.baseUrl
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.replace(/^localhost/, "本机")
    .replace(/^127\.0\.0\.1/, "本机")
    .slice(0, 12);
  return host ? `${short}·${host}` : short;
}
