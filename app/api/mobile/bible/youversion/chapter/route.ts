import { NextResponse } from "next/server";
import { loadYouVersionChapterRows } from "@/lib/bible/providers/youversion";
import {
  loadChapterFromTranslation,
  localSubstituteForYouVersionVersionId,
} from "@/lib/bible/load-chapter-from-default-translation";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const versionId = String(url.searchParams.get("versionId") || "").trim();
  const bookId = String(url.searchParams.get("bookId") || "").trim().toUpperCase();
  const chapter = Number(url.searchParams.get("chapter"));
  if (!versionId || !bookId || !Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
  }
  // 和合本那几个读本地库，不抓网页（Josh 2026-09-23「1 改」）。
  // **这一段是给原生 App 用的**：iOS / 安卓传的是数字 versionId，走不到
  // loadChapterFromTranslation 里那张按译本 id 查的表，所以这里再拦一道。
  // 好处是已经发出去的包不用更新就能生效——它们取经文本来就是问这个接口。
  const localId = localSubstituteForYouVersionVersionId(process.cwd(), versionId);
  if (localId) {
    const local = await loadChapterFromTranslation(process.cwd(), bookId, chapter, localId);
    if (local?.verses?.length) {
      return NextResponse.json({
        ok: true,
        verses: local.verses.map((v) => ({ verse: v.verse, text: v.text })),
      });
    }
  }

  const rows = await loadYouVersionChapterRows(
    {
      id: `youversion-${versionId}`,
      labelZh: versionId,
      labelEn: versionId,
      language: "und",
      sourceFile: "",
      updatedAt: new Date().toISOString(),
      bytes: 0,
      verseCount: 0,
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
