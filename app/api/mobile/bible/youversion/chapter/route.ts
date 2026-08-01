import { NextResponse } from "next/server";
import { loadYouVersionChapterRows } from "@/lib/bible/providers/youversion";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const versionId = String(url.searchParams.get("versionId") || "").trim();
  const bookId = String(url.searchParams.get("bookId") || "").trim().toUpperCase();
  const chapter = Number(url.searchParams.get("chapter"));
  if (!versionId || !bookId || !Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
  }
  const rows = await loadYouVersionChapterRows(
    {
      id: `youversion-${versionId}`,
      labelZh: versionId,
      labelEn: versionId,
      language: "und",
      provider: "youversion",
      remoteId: versionId,
      delivery: "chapter-api",
      enabled: true,
    },
    bookId,
    chapter,
  );
  if (!rows?.length) return NextResponse.json({ ok: false, error: "chapter_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, verses: rows });
}
