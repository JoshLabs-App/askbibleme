import { getNextScriptureChapter } from "@/lib/bible/next-scripture-chapter";
import {
  resolveChapterAudioPlayableSrc,
  translationSupportsChapterAudio,
} from "@/lib/bible/read-chapter-audio";
import { translationUsesWebChapterAudio } from "@/lib/bible/web-chapter-audio";
import { fetchChapterVerseTimings } from "@/lib/bible/cuv-chapter-verse-timings";
import { isCuvChapterAudioVoiceId, type CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";

const PARCHMENT_ASSETS = [
  "/read/parchment-scroll-bg-wide.webp",
  "/read/parchment-scroll-bg.webp",
] as const;

function prefetchUrl(url: string): void {
  if (!url.trim()) return;
  try {
    void fetch(url, { mode: "same-origin", credentials: "same-origin", cache: "default" });
  } catch {
    /* ignore */
  }
}

/**
 * 空闲时预取下一章静态资源（ verse-timings、章音频、羊皮背景），供 SW runtime 缓存。
 */
export function prefetchNextReadChapterAssetsIdle(opts: {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
  voiceId: string;
}): void {
  const next = getNextScriptureChapter(opts.bookId, opts.chapter);
  if (!next) return;
  const voice: CuvChapterAudioVoiceId | null = isCuvChapterAudioVoiceId(opts.voiceId)
    ? opts.voiceId
    : null;

  const run = () => {
    for (const u of PARCHMENT_ASSETS) prefetchUrl(u);
    if (!translationSupportsChapterAudio(opts.translationId)) return;
    if (!translationUsesWebChapterAudio(opts.translationId) && !voice) return;
    void (async () => {
      await fetchChapterVerseTimings(
        opts.translationId,
        voice ?? "mandarin",
        next.bookId,
        next.chapter,
      );
      const r = await resolveChapterAudioPlayableSrc({
        translationId: opts.translationId,
        bookName: opts.bookName,
        bookId: next.bookId,
        chapter: next.chapter,
        voiceId: voice ?? "mandarin",
      });
      if (r.ok && r.src) prefetchUrl(r.src);
    })();
  };

  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => run(), { timeout: 4000 });
  } else {
    window.setTimeout(run, 800);
  }
}
