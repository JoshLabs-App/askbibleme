import { NextResponse } from "next/server";
import { readGenerationRolesSync, resolveGenerationRole } from "@/lib/admin/generation-roles-store";
import { buildInfoEditionV1Messages } from "@/lib/bible/info-edition-v1-prompt";
import type { InfoEditionV1GenerateProfile, InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import { INFO_EDITION_V1_MAX_COMPARE_RUNS } from "@/lib/bible/info-edition-v1-types";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { createChatCompletion } from "@/lib/ai/openai-compatible";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import type { AISettings } from "@/lib/ai/types";
import { scriptureBooks } from "@/lib/bible/scripture-books";
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

function parseProfiles(raw: unknown): InfoEditionV1GenerateProfile[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "请至少选择一个 AI 连接。" };
  }
  const out: InfoEditionV1GenerateProfile[] = [];
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

function parseRoleIds(raw: unknown, legacySingle?: string): string[] | { error: string } {
  const ids: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) ids.push(item.trim());
    }
  }
  if (!ids.length && legacySingle?.trim()) ids.push(legacySingle.trim());
  if (!ids.length) return { error: "请至少选择一个生成角色。" };
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
  const descriptionRules = typeof o.descriptionRules === "string" ? o.descriptionRules : "";
  const legacyRoleId =
    typeof o.generationRoleId === "string" ? o.generationRoleId.trim() : undefined;
  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return NextResponse.json({ ok: false, error: "无效书卷。" }, { status: 400 });
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return NextResponse.json({ ok: false, error: "无效章号。" }, { status: 400 });
  }

  const profiles = parseProfiles(o.profiles);
  if ("error" in profiles) {
    return NextResponse.json({ ok: false, error: profiles.error }, { status: 400 });
  }

  const roleIds = parseRoleIds(o.generationRoleIds, legacyRoleId);
  if ("error" in roleIds) {
    return NextResponse.json({ ok: false, error: roleIds.error }, { status: 400 });
  }

  const totalRuns = roleIds.length * profiles.length;
  if (totalRuns > INFO_EDITION_V1_MAX_COMPARE_RUNS) {
    return NextResponse.json(
      {
        ok: false,
        error: `一次最多 ${INFO_EDITION_V1_MAX_COMPARE_RUNS} 路对比（当前 ${roleIds.length} 角色 × ${profiles.length} AI = ${totalRuns}）。请减少选择。`,
      },
      { status: 400 },
    );
  }

  const loaded = await loadChapterFromDefaultTranslation(bookId, chapter);
  if (!loaded) {
    return NextResponse.json(
      {
        ok: false,
        error: "无法读取本章经文。请先在「译本与上传」登记默认译本。",
      },
      { status: 404 },
    );
  }

  const rolesFile = readGenerationRolesSync(process.cwd());
  const roles = roleIds.map((id) => ({ id, role: resolveGenerationRole(rolesFile, id) }));
  if (roles.some((r) => !r.role)) {
    return NextResponse.json({ ok: false, error: "部分生成角色不可用，请在「生成角色」中检查。" }, { status: 400 });
  }

  const jobs: { role: NonNullable<(typeof roles)[0]["role"]>; profile: InfoEditionV1GenerateProfile }[] = [];
  for (const { role } of roles) {
    if (!role) continue;
    for (const profile of profiles) {
      jobs.push({ role, profile });
    }
  }

  const generations: InfoEditionV1Generation[] = await Promise.all(
    jobs.map(async ({ role, profile: p }) => {
      const messages = buildInfoEditionV1Messages(loaded, descriptionRules, {
        systemPrompt: role.systemPrompt,
      });
      const resolved = resolveAISettings(p.settings, { profileId: p.id });
      if ("error" in resolved) {
        return {
          profileId: p.id,
          profileName: p.name,
          generationRoleId: role.id,
          generationRoleLabel: role.label,
          text: "",
          charCount: 0,
          error: resolved.error,
        };
      }
      const result = await createChatCompletion(resolved, messages);
      if ("error" in result) {
        return {
          profileId: p.id,
          profileName: p.name,
          generationRoleId: role.id,
          generationRoleLabel: role.label,
          text: "",
          charCount: 0,
          error: result.error,
        };
      }
      const text = result.text;
      return {
        profileId: p.id,
        profileName: p.name,
        generationRoleId: role.id,
        generationRoleLabel: role.label,
        text,
        charCount: text.length,
      };
    }),
  );

  return NextResponse.json(
    {
      ok: true,
      bookId,
      bookName: bookMeta.bookName,
      chapter,
      descriptionCharCount: descriptionRules.length,
      generations,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
