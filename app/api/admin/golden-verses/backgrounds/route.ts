import { NextResponse } from "next/server";
import {
  saveGoldenVerseBackgroundFile,
  type GoldenVerseBackgroundItem,
} from "@/lib/golden-verses/background-uploads";
import {
  addGoldenVerseBackground,
  readGoldenVersesSettings,
  removeGoldenVerseBackgrounds,
} from "@/lib/golden-verses/settings-file";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

function diskDenied() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return diskDenied();
  try {
    const cwd = process.cwd();
    const settings = await readGoldenVersesSettings(cwd, { syncDisk: true });
    return NextResponse.json(
      { backgrounds: settings.backgrounds },
      { headers: { "Cache-Control": "no-store, must-revalidate" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return diskDenied();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求体须为 multipart/form-data。" }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段。" }, { status: 400 });
  }
  const labelRaw = form.get("label");
  const label =
    typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim().slice(0, 80) : undefined;
  const cwd = process.cwd();
  try {
    const saved = await saveGoldenVerseBackgroundFile(cwd, file);
    const item: GoldenVerseBackgroundItem = {
      ...saved,
      label,
      addedAt: new Date().toISOString(),
    };
    const settings = await addGoldenVerseBackground(cwd, item);
    return NextResponse.json({ ok: true, item, backgrounds: settings.backgrounds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return diskDenied();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON。" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const idsRaw = o.ids ?? (o.id != null ? [o.id] : null);
  if (!Array.isArray(idsRaw)) {
    return NextResponse.json({ error: "ids 须为字符串数组，或提供 id。" }, { status: 400 });
  }
  const ids = idsRaw
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    .map((x) => x.trim());
  if (ids.length === 0) {
    return NextResponse.json({ error: "未指定要删除的背景 id。" }, { status: 400 });
  }
  try {
    const cwd = process.cwd();
    const settings = await removeGoldenVerseBackgrounds(cwd, ids);
    return NextResponse.json({ ok: true, backgrounds: settings.backgrounds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
