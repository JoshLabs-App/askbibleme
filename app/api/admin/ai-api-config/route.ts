import { NextResponse } from "next/server";
import {
  newAiApiSlotId,
  readAiApiConfigSync,
  toPublicConfig,
  writeAiApiConfigSync,
} from "@/lib/admin/ai-api-config-store";
import { AI_API_CONFIG_MASK, type AiApiConfigSlot } from "@/lib/admin/ai-api-config-types";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

function mergeKey(incoming: unknown, existing: string, masked: string | null): string {
  if (incoming === null || incoming === undefined) return existing;
  const v = typeof incoming === "string" ? incoming.trim() : "";
  if (!v) return "";
  if (masked && (v === masked || v === AI_API_CONFIG_MASK || v.startsWith(AI_API_CONFIG_MASK))) {
    return existing;
  }
  return v;
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const file = readAiApiConfigSync(process.cwd());
  const envHint = {
    hasBaseUrl: Boolean(process.env.AI_BASE_URL?.trim()),
    hasApiKey: Boolean(
      process.env.AI_API_KEY?.trim() ||
        process.env.AI_BEARER_TOKEN?.trim() ||
        process.env.OPENAI_API_KEY?.trim(),
    ),
  };
  return NextResponse.json(
    { ok: true, config: toPublicConfig(file), envHint },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "须为 JSON。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "无效请求体。" }, { status: 400 });
  }

  const cwd = process.cwd();
  const prev = readAiApiConfigSync(cwd);
  const prevPublic = toPublicConfig(prev);
  const o = body as Record<string, unknown>;

  const slotsIn = Array.isArray(o.slots) ? o.slots : null;
  if (!slotsIn) {
    return NextResponse.json({ ok: false, error: "缺少 slots 数组。" }, { status: 400 });
  }

  const prevById = new Map(prev.slots.map((s) => [s.id, s]));
  const prevMask = new Map(prevPublic.slots.map((s) => [s.id, s.maskedKey]));

  const slots: AiApiConfigSlot[] = [];
  for (const raw of slotsIn) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    let id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id) id = newAiApiSlotId();
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const hostContains =
      typeof row.hostContains === "string" ? row.hostContains.trim().toLowerCase() : "";
    if (!label) continue;
    const existing = prevById.get(id)?.apiKey ?? "";
    const masked = prevMask.get(id) ?? null;
    const apiKey = mergeKey(row.apiKey, existing, masked);
    slots.push({
      id,
      label,
      hostContains,
      apiKey,
      enabled: row.enabled !== false,
    });
  }

  const profileKeys: Record<string, string> = { ...prev.profileKeys };
  const profilesIn = o.profileKeys;
  if (profilesIn && typeof profilesIn === "object" && !Array.isArray(profilesIn)) {
    for (const [id, val] of Object.entries(profilesIn as Record<string, unknown>)) {
      const pid = id.trim();
      if (!pid) continue;
      if (!val || typeof val !== "object") continue;
      const row = val as Record<string, unknown>;
      const existing = prev.profileKeys[pid] ?? "";
      const masked = prevPublic.profileKeys[pid]?.maskedKey ?? null;
      profileKeys[pid] = mergeKey(row.apiKey, existing, masked);
    }
  }

  const next = { version: prev.version, slots, profileKeys, studioConnections: prev.studioConnections };
  writeAiApiConfigSync(cwd, next);
  return NextResponse.json({ ok: true, config: toPublicConfig(next) });
}
