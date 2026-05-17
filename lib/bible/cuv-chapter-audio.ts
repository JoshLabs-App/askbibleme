/**
 * 和合本（CUV）整章朗读音源。
 * - 自托管（推荐生产）：仅 ` /audio/{BOOK}-{chapter}.mp3 `（public 或 DATA_ROOT/audio）
 * - 开发回退：未开自托管时，本地不存在则回退 theaudiopower.org
 */

export const CUV_CHAPTER_AUDIO_REMOTE_BASE = "https://theaudiopower.org/CUV/Recordings";

/** 生产自托管：仅使用本站 `/audio/{BOOK}-{章}.mp3`，不回退外部 CDN */
export function isCuvChapterAudioSelfHosted(): boolean {
  return (
    process.env.NEXT_PUBLIC_CUV_CHAPTER_AUDIO_SELF_HOSTED === "1" ||
    process.env.CUV_CHAPTER_AUDIO_SELF_HOSTED === "1"
  );
}

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
  const local = buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  if (!local) return { ok: false };

  const tryLocal = async (): Promise<{ ok: true; src: string } | null> => {
    try {
      const check = await fetch(local, { method: "HEAD", cache: "force-cache" });
      if (check.ok) return { ok: true, src: local };
    } catch {
      /* missing */
    }
    return null;
  };

  const localHit = await tryLocal();
  if (localHit) return localHit;

  if (isCuvChapterAudioSelfHosted()) {
    return { ok: false };
  }

  const remote = buildExternalCuvChapterAudioUrl(args.bookName, args.chapter);
  if (!remote) return { ok: false };
  return { ok: true, src: remote };
}
