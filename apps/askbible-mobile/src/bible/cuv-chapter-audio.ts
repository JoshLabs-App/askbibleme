import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  buildExternalTeochewNtChapterAudioUrl,
  buildLocalTeochewNtChapterAudioUrl,
} from "./teochew-nt-audio";
import { type CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";
import { scriptureBooks } from "./scripture-books";

export const CUV_CHAPTER_AUDIO_REMOTE_BASE = "https://media.fhl.net/unvdavid";
export const CUV_CHAPTER_AUDIO_LOCAL_SUBDIR = "cuv-v20";

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

export { buildLocalTeochewNtChapterAudioUrl, buildExternalTeochewNtChapterAudioUrl } from "./teochew-nt-audio";

export async function resolveCuvChapterAudioPlayableSrc(args: {
  baseUrl: string;
  bookName: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const bundled = isMobileBundledOnly()
    ? resolveBundledChapterAudioUri({
        translationId: "cuv-simp",
        bookId: args.bookId,
        chapter: args.chapter,
        voiceId: args.voiceId,
      })
    : null;
  if (bundled) return { ok: true, src: bundled };
  return { ok: false };
}

export function scriptureAudioUrlsEqual(a: string, b: string): boolean {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  return left === right;
}
