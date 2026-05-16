import { NextResponse } from "next/server";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";
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

  const loaded = await loadChapterFromDefaultTranslation(bookId, chapter);
  if (!loaded) {
    return NextResponse.json(
      {
        ok: false,
        error: "无法读取本章经文。请先在「译本与上传」登记默认译本并上传 JSON。",
      },
      { status: 404 },
    );
  }

  const preview = loaded.verses
    .slice(0, 6)
    .map((v) => `${v.verse} ${v.text}`)
    .join("\n");

  return NextResponse.json(
    {
      ok: true,
      bookId: loaded.bookId,
      bookName: loaded.bookName,
      chapter: loaded.chapter,
      translationId: loaded.translationId,
      labelZh: loaded.labelZh,
      verseCount: loaded.verses.length,
      preview,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
