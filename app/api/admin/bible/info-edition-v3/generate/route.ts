import { NextResponse } from "next/server";
import { readGenerationRolesSync, resolveGenerationRole } from "@/lib/admin/generation-roles-store";
import type { AISettings } from "@/lib/ai/types";
import {
  correctionPhaseFromRoleId,
  isInfoEditionV3CritiqueRole,
} from "@/lib/bible/info-edition-v3-correction-roles";
import { INFO_EDITION_V3_MAX_COMPARE_RUNS } from "@/lib/bible/info-edition-v3-correction-types";
import { loadInfoEditionV3ChapterSource } from "@/lib/bible/info-edition-v3-load-source";
import { runInfoEditionV3CritiqueCompare } from "@/lib/bible/info-edition-v3-run-correction";
import { scriptureBooks } from "@/lib/bible/scripture-books";
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
  if (!Array.isArray(raw)) return { error: "请至少选择一个找错角色。" };
  const ids = raw
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  if (!ids.length) return { error: "请至少选择一个找错角色。" };
  return [...new Set(ids)];
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
  const bookId = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : "";
  const chapter = Number(o.chapter);
  const editorNotes = typeof o.editorNotes === "string" ? o.editorNotes : "";

  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return NextResponse.json({ ok: false, error: "无效书卷。" }, { status: 400 });
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return NextResponse.json({ ok: false, error: "无效章号。" }, { status: 400 });
  }

  const profiles = parseProfiles(o.profiles);
  if ("error" in profiles) {
    return NextResponse.json({ ok: false, error: profiles.error }, { status: 400 });
  }

  const roleIds = parseRoleIds(o.generationRoleIds);
  if ("error" in roleIds) {
    return NextResponse.json({ ok: false, error: roleIds.error }, { status: 400 });
  }

  const cwd = process.cwd();
  const rolesFile = readGenerationRolesSync(cwd);
  const resolvedRoles = roleIds
    .map((id) => resolveGenerationRole(rolesFile, id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (resolvedRoles.length !== roleIds.length) {
    return NextResponse.json({ ok: false, error: "部分找错角色不可用。" }, { status: 400 });
  }
  if (resolvedRoles.some((r) => !isInfoEditionV3CritiqueRole(r))) {
    return NextResponse.json(
      {
        ok: false,
        error: "V3 找错页仅支持「诊断/批判」角色，不生成修订稿。请在「生成角色」中启用 V3·找错诊断。",
      },
      { status: 400 },
    );
  }

  const totalRuns = roleIds.length * profiles.length;
  if (totalRuns > INFO_EDITION_V3_MAX_COMPARE_RUNS) {
    return NextResponse.json(
      {
        ok: false,
        error: `一次最多 ${INFO_EDITION_V3_MAX_COMPARE_RUNS} 路对比（当前 ${roleIds.length} 角色 × ${profiles.length} AI = ${totalRuns}）。`,
      },
      { status: 400 },
    );
  }

  const loaded = await loadInfoEditionV3ChapterSource(cwd, bookId, chapter);
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.error }, { status: 404 });
  }

  if (!loaded.source.infoV1?.markdown.trim() && !loaded.source.guideV2?.markdown.trim()) {
    return NextResponse.json(
      { ok: false, error: "本章尚无已发布讲解版或发现版，无法找错。" },
      { status: 400 },
    );
  }

  const generations = await runInfoEditionV3CritiqueCompare({
    source: loaded.source,
    profiles,
    roles: resolvedRoles,
    editorNotes,
  });

  return NextResponse.json(
    {
      ok: true,
      bookId,
      bookName: bookMeta.bookName,
      chapter,
      generations,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
