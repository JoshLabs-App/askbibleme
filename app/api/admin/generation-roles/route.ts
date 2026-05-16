import { NextResponse } from "next/server";
import {
  newGenerationRoleId,
  readGenerationRolesSync,
  toPublicRoles,
  writeGenerationRolesSync,
} from "@/lib/admin/generation-roles-store";
import type { GenerationRole } from "@/lib/admin/generation-roles-types";
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

function parseRoles(raw: unknown): GenerationRole[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "roles 须为数组。" };
  const out: GenerationRole[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    let id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) id = newGenerationRoleId();
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const hint = typeof o.hint === "string" ? o.hint.trim() : "";
    const systemPrompt = typeof o.systemPrompt === "string" ? o.systemPrompt.trim() : "";
    if (!systemPrompt) return { error: `角色「${label || id}」缺少 system 指令。` };
    const enabled = o.enabled !== false;
    const builtin = o.builtin === true;
    out.push({
      id,
      label: label || id,
      hint,
      systemPrompt,
      enabled,
      ...(builtin ? { builtin: true } : {}),
    });
  }
  if (!out.length) return { error: "至少保留一个角色。" };
  return out;
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const file = readGenerationRolesSync(process.cwd());
  return NextResponse.json(
    { ok: true, config: toPublicRoles(file) },
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
  const o = body as Record<string, unknown>;
  const roles = parseRoles(o.roles);
  if ("error" in roles) {
    return NextResponse.json({ ok: false, error: roles.error }, { status: 400 });
  }
  const defaultRoleId =
    typeof o.defaultRoleId === "string" ? o.defaultRoleId.trim() : readGenerationRolesSync(process.cwd()).defaultRoleId;

  writeGenerationRolesSync(process.cwd(), {
    version: 1,
    defaultRoleId,
    roles,
  });

  const file = readGenerationRolesSync(process.cwd());
  return NextResponse.json({ ok: true, config: toPublicRoles(file) });
}
