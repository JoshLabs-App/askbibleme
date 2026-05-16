import { NextResponse } from "next/server";
import {
  listAllConnectionsPublic,
  readAiApiConfigSync,
  writeStudioConnectionsSync,
} from "@/lib/admin/ai-api-config-store";
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

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const file = readAiApiConfigSync(process.cwd());
  const connections = listAllConnectionsPublic(file);
  const syncedAt =
    connections.length > 0
      ? connections.reduce((max, c) => (c.syncedAt > max ? c.syncedAt : max), "")
      : null;
  return NextResponse.json(
    { ok: true, connections, syncedAt: syncedAt || null },
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

  const raw = (body as Record<string, unknown>).connections;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "缺少 connections 数组。" }, { status: 400 });
  }

  const connections: { id: string; name: string; baseUrl: string; model: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const baseUrl = typeof row.baseUrl === "string" ? row.baseUrl.trim() : "";
    if (!id || !baseUrl) continue;
    connections.push({
      id,
      name: typeof row.name === "string" ? row.name.trim() : id,
      baseUrl,
      model: typeof row.model === "string" ? row.model.trim() : "",
    });
  }

  const file = writeStudioConnectionsSync(process.cwd(), connections);
  const publicConnections = listAllConnectionsPublic(file);
  const syncedAt =
    publicConnections.length > 0
      ? publicConnections.reduce((max, c) => (c.syncedAt > max ? c.syncedAt : max), "")
      : null;

  return NextResponse.json({
    ok: true,
    connections: publicConnections,
    syncedAt,
  });
}
