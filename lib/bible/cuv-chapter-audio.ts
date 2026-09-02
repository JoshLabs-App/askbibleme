/**
 * 和合本（CUV）整章朗读音源：直连 FHL 原始站点（`media.fhl.net/unvdavid`），不经
 * askbible.me 存放/转发。
 */

import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { effectiveVoiceForBook, voiceSupportsBook } from "@/lib/bible/cuv-chapter-audio-voices";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { resolveTeochewNtChapterAudioPlayableSrc, teochewNtVoiceActive } from "@/lib/bible/teochew-nt-audio";

export const CUV_CHAPTER_AUDIO_REMOTE_BASE = "https://media.fhl.net/unvdavid";

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

  const remote = buildExternalCuvChapterAudioUrl(args.bookId, args.chapter);
  return remote ? { ok: true, src: remote } : { ok: false };
}
