import { loadBundledChapterSegments, type ChapterSegmentMode } from "@/lib/bible/bundled-chapter-segments";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId")?.trim() ?? "";
  const chapter = Number(searchParams.get("chapter"));
  const modeRaw = searchParams.get("mode")?.trim();
  const mode: ChapterSegmentMode = modeRaw === "t1" ? "t1" : "default";
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) {
    return Response.json({ segments: [] as const }, { status: 400 });
  }
  const segments = loadBundledChapterSegments(process.cwd(), bookId, chapter, mode);
  return Response.json({ segments: segments ?? [] });
}
