import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import { resolveSelfHostedChapterAudioPlayableUrl } from "./chapter-audio-sources";
import { isMobileScriptureReadLocalOnly } from "../config/mobileBundledOnly";
import {
  buildExternalTeochewNtChapterAudioUrl,
  buildLocalTeochewNtChapterAudioUrl,
  resolveTeochewNtChapterAudioPlayableSrc,
  teochewNtVoiceActive,
} from "./teochew-nt-audio";
import {
  effectiveVoiceForBook,
  type CuvChapterAudioVoiceId,
  voiceSupportsBook,
} from "./cuv-chapter-audio-voices";
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
  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);

  const bundled = resolveBundledChapterAudioUri({
    translationId: "cuv-simp",
    bookId: args.bookId,
    chapter: args.chapter,
    voiceId: args.voiceId,
  });
  if (bundled) return { ok: true, src: bundled };

  if (teochewNtVoiceActive(voice)) {
    return resolveTeochewNtChapterAudioPlayableSrc({
      bookId: args.bookId,
      chapter: args.chapter,
      baseUrl: args.baseUrl,
    });
  }
  if (!voiceSupportsBook(voice, args.bookId)) return { ok: false };

  if (isMobileScriptureReadLocalOnly()) return { ok: false };

  // 与 Web 一致：默认 FHL 外链；自托管 cuv-v20 仅部分章节上架，作备选。
  const remote = buildExternalCuvChapterAudioUrl(args.bookId, args.chapter);
  if (remote) return { ok: true, src: remote };

  const selfHosted = resolveSelfHostedChapterAudioPlayableUrl({
    translationId: "cuv-simp",
    bookId: args.bookId,
    chapter: args.chapter,
    voiceId: args.voiceId,
    siteBaseUrl: args.baseUrl,
  });
  if (selfHosted) return { ok: true, src: selfHosted };

  return { ok: false };
}

export function scriptureAudioUrlsEqual(a: string, b: string): boolean {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  return left === right;
}
