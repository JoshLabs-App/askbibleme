/**
 * 和合本（CUV）整章朗读音源：与 AskBible 2 `reader/page.tsx` 同源。
 * 优先本机 `public/audio/{BOOK}-{chapter}.mp3`（HEAD 成功），否则回退远程 CDN。
 */
export const CUV_CHAPTER_AUDIO_REMOTE_BASE = "https://theaudiopower.org/CUV/Recordings";

export function translationSupportsCuvChapterAudio(translationId: string): boolean {
  return String(translationId || "")
    .trim()
    .toLowerCase()
    .startsWith("cuv");
}

export function buildExternalCuvChapterAudioUrl(bookName: string, chapter: number): string {
  const name = String(bookName || "").trim();
  if (!name || !Number.isInteger(chapter) || chapter < 1) return "";
  return `${CUV_CHAPTER_AUDIO_REMOTE_BASE}/${encodeURIComponent(`${name} ${chapter}`)}.mp3`;
}

export function buildLocalCuvChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `/audio/${id}-${chapter}.mp3`;
}

/** 与 AskBible `readerAudioSourceSameAs` 一致：比较时归一化为绝对 URL。 */
export function readerChapterAudioSourceSameAs(audio: HTMLAudioElement, candidateUrl: string): boolean {
  const trimmed = String(candidateUrl || "").trim();
  if (!trimmed) return false;
  if (typeof window === "undefined") {
    return (audio.currentSrc || audio.src || "").trim() === trimmed;
  }
  try {
    const target = new URL(trimmed, window.location.href).href;
    const raw = (audio.currentSrc || audio.src || "").trim();
    if (!raw) return false;
    return new URL(raw, window.location.href).href === target;
  } catch {
    return (audio.currentSrc || audio.src || "").trim() === trimmed;
  }
}

export async function resolveCuvChapterAudioPlayableSrc(args: {
  bookName: string;
  bookId: string;
  chapter: number;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const remote = buildExternalCuvChapterAudioUrl(args.bookName, args.chapter);
  if (!remote) return { ok: false };
  const local = buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  if (local) {
    try {
      const check = await fetch(local, { method: "HEAD", cache: "force-cache" });
      if (check.ok) return { ok: true, src: local };
    } catch {
      /* use remote */
    }
  }
  return { ok: true, src: remote };
}
