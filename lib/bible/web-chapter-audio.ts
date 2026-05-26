/**
 * World English Bible（WEB）整章朗读；`bbe-en` 与 `web-en` 共用此音轨。
 * - 自托管：`/audio/web-en/{BOOK}-{chapter}.mp3`
 * - 开发回退：theaudiopower.org（旧约 WEB2，新约 WEB）
 */

import {
  webChapterAudioBookNameEn,
  webChapterAudioRemoteBase,
} from "@/lib/bible/web-chapter-audio-book-names";

export const WEB_CHAPTER_AUDIO_SUBDIR = "web-en";

export function translationUsesWebChapterAudio(translationId: string): boolean {
  const id = String(translationId || "")
    .trim()
    .toLowerCase();
  return id === "web-en" || id === "bbe-en";
}

export function isWebChapterAudioSelfHosted(): boolean {
  return (
    process.env.NEXT_PUBLIC_WEB_CHAPTER_AUDIO_SELF_HOSTED === "1" ||
    process.env.WEB_CHAPTER_AUDIO_SELF_HOSTED === "1" ||
    process.env.NEXT_PUBLIC_CUV_CHAPTER_AUDIO_SELF_HOSTED === "1" ||
    process.env.CUV_CHAPTER_AUDIO_SELF_HOSTED === "1"
  );
}

export function buildExternalWebChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  const name = webChapterAudioBookNameEn(id);
  const base = webChapterAudioRemoteBase(id);
  return `${base}/${encodeURIComponent(`${name} ${chapter}`)}.mp3`;
}

export function buildLocalWebChapterAudioUrl(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `/audio/${WEB_CHAPTER_AUDIO_SUBDIR}/${id}-${chapter}.mp3`;
}

export async function resolveWebChapterAudioPlayableSrc(args: {
  bookId: string;
  chapter: number;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const local = buildLocalWebChapterAudioUrl(args.bookId, args.chapter);
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

  if (isWebChapterAudioSelfHosted()) {
    return { ok: false };
  }

  const remote = buildExternalWebChapterAudioUrl(args.bookId, args.chapter);
  if (!remote) return { ok: false };
  return { ok: true, src: remote };
}
