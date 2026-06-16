import { NextResponse } from "next/server";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
import { loadInfoEditionV3ChapterSource } from "@/lib/bible/info-edition-v3-load-source";
import { resolveInfoEditionV3DeepSeek } from "@/lib/bible/info-edition-v3-resolve-deepseek";
import {
  INFO_EDITION_V3_CRITIQUE_ROLE_ID,
  INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID,
  INFO_EDITION_V3_REVISE_INFO_ROLE_ID,
} from "@/lib/bible/info-edition-v3-correction-roles";
import { runInfoEditionV3CorrectionPipeline } from "@/lib/bible/info-edition-v3-run-correction";
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
  const critiqueText = typeof o.critiqueText === "string" ? o.critiqueText : "";
  const dryRun = o.dryRun === true;

  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return NextResponse.json({ ok: false, error: "无效书卷。" }, { status: 400 });
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return NextResponse.json({ ok: false, error: "无效章号。" }, { status: 400 });
  }

  const cwd = process.cwd();
  const deepseek = resolveInfoEditionV3DeepSeek(cwd);
  if ("error" in deepseek) {
    return NextResponse.json({ ok: false, error: deepseek.error }, { status: 400 });
  }

  const loaded = await loadInfoEditionV3ChapterSource(cwd, bookId, chapter);
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.error }, { status: 404 });
  }
  if (!loaded.source.infoV1?.markdown.trim() && !loaded.source.guideV2?.markdown.trim()) {
    return NextResponse.json(
      { ok: false, error: "本章尚无已发布讲解版或发现版，无法纠错。" },
      { status: 400 },
    );
  }

  const rolesFile = readGenerationRolesSync(cwd);
  const roleIds = [
    INFO_EDITION_V3_CRITIQUE_ROLE_ID,
    INFO_EDITION_V3_REVISE_INFO_ROLE_ID,
    INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID,
  ];
  const roles = roleIds
    .map((id) => rolesFile.roles.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (roles.length < 3) {
    return NextResponse.json(
      {
        ok: false,
        error: "V3 纠错角色未就绪：请在「生成角色」中启用 V3·找错诊断、V3·修订讲解、V3·修订发现。",
      },
      { status: 400 },
    );
  }

  const result = await runInfoEditionV3CorrectionPipeline(
    cwd,
    loaded.source,
    roles,
    deepseek.profile,
    deepseek.settings,
    { editorNotes, critiqueText: critiqueText || undefined, publish: !dryRun },
  );

  const ok = result.errors.length === 0;
  return NextResponse.json(
    {
      ok,
      bookName: bookMeta.bookName,
      dryRun,
      ...result,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
