import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  collectReferencedPublicUrls,
  deleteMediaLibraryFiles,
  listMediaLibraryItems,
} from "@/lib/admin/media-library";

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
      },
      { status: 403 },
    );
  }
  try {
    const cwd = process.cwd();
    const [items, referenced] = await Promise.all([
      listMediaLibraryItems(cwd),
      collectReferencedPublicUrls(cwd),
    ]);
    const enriched = items.map((i) => ({
      ...i,
      referenced: referenced.has(i.url),
    }));
    return NextResponse.json(
      { items: enriched },
      { headers: { "Cache-Control": "no-store, must-revalidate" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许写磁盘：开发环境默认可写；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
      },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON。" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const urlsRaw = o.urls;
  if (!Array.isArray(urlsRaw)) {
    return NextResponse.json({ error: "urls 须为字符串数组。" }, { status: 400 });
  }
  const urls = urlsRaw.filter((x): x is string => typeof x === "string");
  const force = Boolean(o.force);
  try {
    const cwd = process.cwd();
    const referenced = await collectReferencedPublicUrls(cwd);
    const results = await deleteMediaLibraryFiles(cwd, urls, { force }, referenced);
    const ok = results.every((r) => r.ok);
    return NextResponse.json({ ok, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
