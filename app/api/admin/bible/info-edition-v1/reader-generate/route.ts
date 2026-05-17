import { NextResponse } from "next/server";
import {
  executeInfoEditionReaderPlan,
  planInfoEditionReaderGeneration,
  planToPublicPayload,
} from "@/lib/bible/info-edition-v1-reader-generate-plan";
import {
  parseInfoEditionReaderVariant,
  readerVariantToRoleId,
} from "@/lib/bible/info-edition-v1-publish";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { validateInfoEditionOutput } from "@/lib/bible/info-edition-v1-output-validate";
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
  const variant = parseInfoEditionReaderVariant(
    typeof o.variant === "string" ? o.variant : typeof o.edition === "string" ? o.edition : "",
  );
  const previewOnly = o.previewOnly === true;
  const publish = o.publish === true;
  const descriptionRules =
    typeof o.descriptionRules === "string" ? o.descriptionRules : undefined;

  if (!variant) {
    return NextResponse.json(
      { ok: false, error: "缺少 variant（info 或 guide）。" },
      { status: 400 },
    );
  }

  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return NextResponse.json({ ok: false, error: "无效书卷。" }, { status: 400 });
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return NextResponse.json({ ok: false, error: "无效章号。" }, { status: 400 });
  }

  const cwd = process.cwd();
  const roles = readGenerationRolesSync(cwd).roles;
  const roleId = readerVariantToRoleId(variant, roles);
  const target = { variant, roleId };

  const planned = await planInfoEditionReaderGeneration(cwd, bookId, chapter, target, {
    descriptionRulesOverride: descriptionRules,
  });
  if (!planned.ok) {
    return NextResponse.json({ ok: false, error: planned.error }, { status: 400 });
  }

  const probe = planToPublicPayload(planned.plan);

  if (previewOnly) {
    return NextResponse.json(
      {
        ok: true,
        previewOnly: true,
        probe,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const executed = await executeInfoEditionReaderPlan(cwd, bookId, chapter, planned.plan, {
    publish,
  });
  if (!executed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: executed.error,
        probe: executed.plan ? planToPublicPayload(executed.plan) : probe,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const outputValidation = validateInfoEditionOutput(executed.generation.text, variant);

  return NextResponse.json(
    {
      ok: true,
      previewOnly: false,
      published: Boolean(executed.published),
      probe,
      outputValidation,
      generation: {
        profileId: executed.generation.profileId,
        profileName: executed.generation.profileName,
        generationRoleId: executed.generation.generationRoleId,
        generationRoleLabel: executed.generation.generationRoleLabel,
        text: executed.generation.text,
        charCount: executed.generation.charCount,
        error: executed.generation.error,
      },
      publishedChapter: executed.published ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
