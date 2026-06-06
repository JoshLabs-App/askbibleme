/**
 * 和合本（CUV）整章朗读音源。
 * - 自托管（推荐生产）：仅 ` /audio/{BOOK}-{chapter}.mp3 `（public 或 DATA_ROOT/audio）
 * - 潮州语新约：`/audio/teochew-nt/{BOOK}-{chapter}.mp3`（见 teochew-nt-audio-manifest.json）
 * - 开发回退：未开自托管时，本地不存在则回退 FHL（version=20）
 */

import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { effectiveVoiceForBook, voiceSupportsBook } from "@/lib/bible/cuv-chapter-audio-voices";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { resolveTeochewNtChapterAudioPlayableSrc, teochewNtVoiceActive } from "@/lib/bible/teochew-nt-audio";

export const CUV_CHAPTER_AUDIO_REMOTE_BASE = "https://media.fhl.net/unvdavid";
export const CUV_CHAPTER_AUDIO_LOCAL_SUBDIR = "cuv-v20";

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

export function buildExternalCuvChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  const meta = scriptureBooks.find((b) => b.bookId === id);
  if (!meta) return "";
  const bid = meta.bookNumber;
  return `${CUV_CHAPTER_AUDIO_REMOTE_BASE}/${bid}/${bid}_${String(chapter).padStart(3, "0")}.mp3`;
}

export function buildLocalCuvChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `/audio/${CUV_CHAPTER_AUDIO_LOCAL_SUBDIR}/${id}-${chapter}.mp3`;
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
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);
  if (teochewNtVoiceActive(voice)) {
    return resolveTeochewNtChapterAudioPlayableSrc({
      bookId: args.bookId,
      chapter: args.chapter,
    });
  }
  if (!voiceSupportsBook(voice, args.bookId)) return { ok: false };

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

  const remote = buildExternalCuvChapterAudioUrl(args.bookId, args.chapter);
  if (!remote) return { ok: false };
  return { ok: true, src: remote };
}
