import { NextResponse } from "next/server";
import {
  resolveYouVersionChapterAudioPlayableSrc,
  translationUsesYouVersionChapterAudio,
} from "@/lib/bible/youversion-chapter-audio";
import {
  resolveEsvChapterAudioDirectUrl,
  translationUsesEsvChapterAudio,
} from "@/lib/bible/esv-chapter-audio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const translationId = (url.searchParams.get("translationId") ?? "").trim().toLowerCase();
  const bookId = (url.searchParams.get("bookId") ?? "").trim().toUpperCase();
  const chapter = Number(url.searchParams.get("chapter"));

  const isEsv = translationUsesEsvChapterAudio(translationId);
  if (
    (!isEsv && !translationUsesYouVersionChapterAudio(translationId)) ||
    !/^[A-Z0-9]{2,8}$/.test(bookId) ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    chapter > 176
  ) {
    return NextResponse.json({ error: "invalid_chapter_audio_request" }, { status: 400 });
  }

  // ESV：用服务端的 API key 向 Crossway 换一次直链，音频本体不经过我们。
  const result = isEsv
    ? await (async () => {
        const src = await resolveEsvChapterAudioDirectUrl({ bookId, chapter });
        return src ? ({ ok: true, src } as const) : ({ ok: false } as const);
      })()
    : await resolveYouVersionChapterAudioPlayableSrc({
        translationId,
        bookId,
        chapter,
      });
  if (!result.ok) {
    return NextResponse.json({ error: "chapter_audio_unavailable" }, { status: 404 });
  }
  return NextResponse.json(
    { src: result.src },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
