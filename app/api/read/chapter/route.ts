import { NextResponse } from "next/server";
import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import {
  loadChapterSegmentsFromLocalDataset,
  loadChapterSegmentsFromOpenUsfm,
} from "@/lib/bible/load-chapter-segments";
import { readTranslationsIndexSync } from "@/lib/bible/translations-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bookId = String(url.searchParams.get("bookId") || "")
    .trim()
    .toUpperCase();
  const chapter = Number(url.searchParams.get("chapter"));
  const translationId = String(url.searchParams.get("translationId") || "").trim();

  if (!bookId || !Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
  }

  const cwd = process.cwd();
  const index = readTranslationsIndexSync(cwd);
  const resolvedTranslationId =
    translationId || index.defaultTranslationId || index.translations[0]?.id || "";
  if (!resolvedTranslationId) {
    return NextResponse.json({ ok: false, error: "missing_translation" }, { status: 500 });
  }

  const chapterData = await loadChapterFromTranslation(cwd, bookId, chapter, resolvedTranslationId);
  if (!chapterData) {
    return NextResponse.json({ ok: false, error: "chapter_not_found" }, { status: 404 });
  }

  const maxVerse = chapterData.verses.reduce((max, row) => Math.max(max, row.verse), 0) || null;
  const segments =
    loadChapterSegmentsFromLocalDataset(cwd, bookId, chapter) ??
    (await loadChapterSegmentsFromOpenUsfm(bookId, chapter, maxVerse));

  return NextResponse.json({
    ok: true,
    data: {
      ...chapterData,
      segments,
    },
  });
}
