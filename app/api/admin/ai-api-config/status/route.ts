import { NextResponse } from "next/server";
import { resolveAdminKeySource } from "@/lib/admin/ai-api-config-resolve";
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

  const raw = (body as Record<string, unknown>).profiles;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "缺少 profiles 数组。" }, { status: 400 });
  }

  const profiles: { id: string; keySource: string; ready: boolean }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const baseUrl = typeof row.baseUrl === "string" ? row.baseUrl.trim() : "";
    const model = typeof row.model === "string" ? row.model.trim() : "";
    if (!id) continue;
    const ready = Boolean(baseUrl && model);
    const { source } = resolveAdminKeySource(
      {
        provider: "openai-compatible",
        baseUrl,
        model,
        apiKey: typeof row.apiKey === "string" ? row.apiKey : undefined,
      },
      { profileId: id },
    );
    profiles.push({ id, keySource: source, ready });
  }

  return NextResponse.json({ ok: true, profiles }, { headers: { "Cache-Control": "no-store" } });
}
