import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { SELAH_BIBLE_FORMAT } from "@/lib/bible/translations-types";
import {
  deleteTranslationFile,
  readTranslationsIndex,
  translationFileRel,
  writeTranslationPayload,
  writeTranslationsIndex,
} from "@/lib/bible/translations-store";
import { parseAndValidateBiblePayload } from "@/lib/bible/validate-bible-json";

const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

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
  try {
    const index = await readTranslationsIndex(process.cwd());
    return NextResponse.json(index, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "须为 multipart 表单。" }, { status: 400 });
  }
  const id = String(form.get("id") ?? "").trim();
  const labelZh = String(form.get("labelZh") ?? "").trim();
  const labelEn = String(form.get("labelEn") ?? "").trim();
  const language = String(form.get("language") ?? "").trim();
  const file = form.get("file");

  if (!ID_RE.test(id)) {
    return NextResponse.json(
      { error: "id 须为小写字母、数字、连字符或下划线，1～48 字符，且以字母或数字开头。" },
      { status: 400 },
    );
  }
  if (!labelZh || !labelEn || !language) {
    return NextResponse.json({ error: "labelZh、labelEn、language 均不能为空。" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "请上传非空的 .json 文件。" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `单文件过大（上限 ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB）。` },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith(".json")) {
    return NextResponse.json({ error: "仅接受 .json 文件。" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "无法解析 JSON。" }, { status: 400 });
  }

  let verseCount: number;
  let books: Record<string, Record<string, Record<string, string>>>;
  try {
    const v = parseAndValidateBiblePayload(parsed);
    verseCount = v.verseCount;
    books = v.books;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const cwd = process.cwd();
  try {
    const { bytes } = await writeTranslationPayload(cwd, id, {
      format: SELAH_BIBLE_FORMAT,
      books,
    });
    const index = await readTranslationsIndex(cwd);
    const wasEmpty = index.translations.length === 0;
    const now = new Date().toISOString();
    const meta = {
      id,
      labelZh,
      labelEn,
      language,
      sourceFile: translationFileRel(id),
      updatedAt: now,
      bytes,
      verseCount,
    };
    const next = index.translations.filter((t) => t.id !== id);
    next.push(meta);
    next.sort((a, b) => a.id.localeCompare(b.id));
    let defaultTranslationId = index.defaultTranslationId;
    if (wasEmpty) {
      defaultTranslationId = id;
    }
    await writeTranslationsIndex(cwd, { translations: next, defaultTranslationId });
    return NextResponse.json({ ok: true, meta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON。" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const raw = o.defaultTranslationId;
  const cwd = process.cwd();
  const index = await readTranslationsIndex(cwd);
  if (raw === null || raw === "") {
    await writeTranslationsIndex(cwd, { ...index, defaultTranslationId: null });
    return NextResponse.json({ ok: true, defaultTranslationId: null });
  }
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "defaultTranslationId 须为字符串或 null。" }, { status: 400 });
  }
  const tid = raw.trim();
  if (!tid) {
    await writeTranslationsIndex(cwd, { ...index, defaultTranslationId: null });
    return NextResponse.json({ ok: true, defaultTranslationId: null });
  }
  if (!index.translations.some((t) => t.id === tid)) {
    return NextResponse.json({ error: "未找到该译本 id。" }, { status: 400 });
  }
  await writeTranslationsIndex(cwd, { ...index, defaultTranslationId: tid });
  return NextResponse.json({ ok: true, defaultTranslationId: tid });
}

export async function DELETE(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "无效的 id。" }, { status: 400 });
  }
  const cwd = process.cwd();
  const index = await readTranslationsIndex(cwd);
  const hit = index.translations.find((t) => t.id === id);
  if (!hit) {
    return NextResponse.json({ error: "未找到该译本。" }, { status: 404 });
  }
  await deleteTranslationFile(cwd, id);
  const next = index.translations.filter((t) => t.id !== id);
  let defaultTranslationId = index.defaultTranslationId;
  if (defaultTranslationId === id) {
    defaultTranslationId = next[0]?.id ?? null;
  }
  await writeTranslationsIndex(cwd, { translations: next, defaultTranslationId });
  return NextResponse.json({ ok: true });
}
