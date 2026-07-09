import { NextResponse } from "next/server";
import { readGenerationRolesSync, resolveGenerationRole } from "@/lib/admin/generation-roles-store";
import type { AISettings } from "@/lib/ai/types";
import {
  isInfoEditionV4CompileRole,
  isInfoEditionV4ReviseRole,
  type InfoEditionV4RolePhase,
} from "@/lib/bible/info-edition-v4-roles";
import { runInfoEditionV4Compare } from "@/lib/bible/info-edition-v4-run";
import { INFO_EDITION_V4_MAX_COMPARE_RUNS } from "@/lib/bible/info-edition-v4-types";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

export const maxDuration = 300;

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

type GenerateProfile = {
  id: string;
  name: string;
  settings: AISettings;
};

function parseProfiles(raw: unknown): GenerateProfile[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "请至少选择一个 AI 连接。" };
  }
  const out: GenerateProfile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const settings = row.settings as Partial<AISettings> | undefined;
    if (!id || !settings) continue;
    out.push({
      id,
      name: name || id,
      settings: {
        provider: settings.provider ?? "openai-compatible",
        baseUrl: String(settings.baseUrl ?? "").trim(),
        model: String(settings.model ?? "").trim(),
        apiKey: settings.apiKey?.trim() || undefined,
      },
    });
  }
  if (!out.length) return { error: "连接配置无效。" };
  return out;
}

function parseRoleIds(raw: unknown): string[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "请至少选择一个生成角色。" };
  const ids = raw
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  if (!ids.length) return { error: "请至少选择一个生成角色。" };
  return [...new Set(ids)];
}

function isRoleForPhase(phase: InfoEditionV4RolePhase, role: { id: string }): boolean {
  if (phase === "compile") return isInfoEditionV4CompileRole(role);
  return isInfoEditionV4ReviseRole(role);
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
  const phaseRaw = typeof o.phase === "string" ? o.phase.trim() : "compile";
  if (phaseRaw !== "compile" && phaseRaw !== "revise") {
    return NextResponse.json({ ok: false, error: "phase 须为 compile | revise。" }, { status: 400 });
  }
  const phase = phaseRaw as InfoEditionV4RolePhase;

  const themeTitle = typeof o.themeTitle === "string" ? o.themeTitle.trim() : "";
  if (!themeTitle) return NextResponse.json({ ok: false, error: "缺少主题名称。" }, { status: 400 });

  const editorNotes = typeof o.editorNotes === "string" ? o.editorNotes : "";
  const compileText = typeof o.compileText === "string" ? o.compileText : "";
  const reviewText = typeof o.reviewText === "string" ? o.reviewText : "";

  if (phase === "revise" && !compileText.trim()) {
    return NextResponse.json({ ok: false, error: "优化修订需要汇编初稿。" }, { status: 400 });
  }

  const profiles = parseProfiles(o.profiles);
  if ("error" in profiles) {
    return NextResponse.json({ ok: false, error: profiles.error }, { status: 400 });
  }

  const roleIds = parseRoleIds(o.generationRoleIds);
  if ("error" in roleIds) {
    return NextResponse.json({ ok: false, error: roleIds.error }, { status: 400 });
  }

  const totalRuns = roleIds.length * profiles.length;
  if (totalRuns > INFO_EDITION_V4_MAX_COMPARE_RUNS) {
    return NextResponse.json(
      {
        ok: false,
        error: `一次最多 ${INFO_EDITION_V4_MAX_COMPARE_RUNS} 路对比（当前 ${roleIds.length} 角色 × ${profiles.length} AI = ${totalRuns}）。`,
      },
      { status: 400 },
    );
  }

  const cwd = process.cwd();
  const rolesFile = readGenerationRolesSync(cwd);
  const resolvedRoles = roleIds
    .map((id) => resolveGenerationRole(rolesFile, id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (resolvedRoles.length !== roleIds.length) {
    return NextResponse.json({ ok: false, error: "部分生成角色不可用。" }, { status: 400 });
  }
  if (resolvedRoles.some((r) => !isRoleForPhase(phase, r))) {
    const label = phase === "compile" ? "V4·经文汇编" : "V4·修订成稿";
    return NextResponse.json(
      { ok: false, error: `本阶段仅支持「${label}」角色，请在「生成角色」中检查。` },
      { status: 400 },
    );
  }

  const generations = await runInfoEditionV4Compare({
    phase,
    themeTitle,
    editorNotes,
    compileText,
    reviewText,
    profiles,
    roles: resolvedRoles,
  });

  return NextResponse.json(
    {
      ok: true,
      phase,
      themeTitle,
      generations,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
