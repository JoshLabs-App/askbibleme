import { NextResponse } from "next/server";
import { loadInfoEditionV3ChapterSource } from "@/lib/bible/info-edition-v3-load-source";
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

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  const url = new URL(req.url);
  const bookId = (url.searchParams.get("bookId") ?? "").trim().toUpperCase();
  const chapter = Number(url.searchParams.get("chapter"));
  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) {
    return NextResponse.json({ ok: false, error: "无效书卷。" }, { status: 400 });
  }
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return NextResponse.json({ ok: false, error: "无效章号。" }, { status: 400 });
  }

  const result = await loadInfoEditionV3ChapterSource(process.cwd(), bookId, chapter);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, source: result.source },
    { headers: { "Cache-Control": "no-store" } },
  );
}
