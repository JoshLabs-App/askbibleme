import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getChapterAudioBaseUrl } from "./chapter-audio-url";
import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import {
  resolveCuvChapterAudioPlayableSrc,
  translationSupportsCuvChapterAudio,
} from "./cuv-chapter-audio";
import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";
import {
  resolveWebChapterAudioPlayableSrc,
  translationUsesWebChapterAudio,
} from "./web-chapter-audio";
import { resolveDownloadedChapterAudioUri } from "../read/read-audio-package-download";

function shouldIgnoreCachedScriptureSrc(cachedSrc: string, translationId: string): boolean {
  const src = cachedSrc.trim().toLowerCase();
  if (!src) return true;
  // WEB/BBE/BLM 在线音轨容易因为开发基址变化拿到失效缓存地址；每次重算更稳。
  if (translationUsesWebChapterAudio(translationId)) {
    return true;
  }
  // CUV 历史外链在部分章节会 404；开发态优先重算更稳的 askbible 自托管链接。
  if (
    translationSupportsCuvChapterAudio(translationId) &&
    (src.includes("theaudiopower.org/cuv/recordings/") ||
      src.includes("media.fhl.net/unvdavid/") ||
      src.includes("askbible.me/audio/cuv-v20/"))
  ) {
    return true;
  }
  return false;
}

/** 同步拼出可播 URL：仅安装包内置（常规播放走本地下载包）。 */
export function buildChapterAudioPlayableSrcSync(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  bookName: string;
  voiceId?: CuvChapterAudioVoiceId;
  baseUrl?: string;
}): string | null {
  if (!isMobileBundledOnly()) return null;
  return (
    resolveBundledChapterAudioUri({
      translationId: args.translationId,
      bookId: args.bookId,
      chapter: args.chapter,
      voiceId: args.voiceId,
    }) ?? null
  );
}

export function translationSupportsChapterAudio(translationId: string): boolean {
  return (
    translationSupportsCuvChapterAudio(translationId) ||
    translationUsesWebChapterAudio(translationId)
  );
}

export async function resolveChapterAudioPlayableSrc(args: {
  baseUrl?: string;
  translationId: string;
  bookName: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  const baseUrl = args.baseUrl ?? getChapterAudioBaseUrl();

  if (translationUsesWebChapterAudio(args.translationId)) {
    return resolveWebChapterAudioPlayableSrc({
      baseUrl,
      translationId: args.translationId,
      bookId: args.bookId,
      chapter: args.chapter,
    });
  }

  const sync = buildChapterAudioPlayableSrcSync({ ...args, baseUrl });
  if (sync) return { ok: true, src: sync };
  if (translationSupportsCuvChapterAudio(args.translationId)) {
    return resolveCuvChapterAudioPlayableSrc({
      baseUrl,
      bookName: args.bookName,
      bookId: args.bookId,
      chapter: args.chapter,
      voiceId: args.voiceId,
    });
  }
  return { ok: false };
}

/** 读经章播放：优先本地下载包，其次安装包内置；不直连外链播放。 */
export async function resolveScripturePlayableSrcForChapter(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  bookName: string;
  voiceId?: CuvChapterAudioVoiceId;
  cachedSrc?: string | null;
}): Promise<string | null> {
  const downloaded = await resolveDownloadedChapterAudioUri({
    translationId: args.translationId,
    voiceId: args.voiceId ?? "mandarin",
    bookId: args.bookId,
    chapter: args.chapter,
  });
  if (downloaded) return downloaded;

  const cached = args.cachedSrc?.trim();
  if (cached && !shouldIgnoreCachedScriptureSrc(cached, args.translationId)) return cached;
  if (!translationSupportsChapterAudio(args.translationId)) return null;

  const resolved = await resolveChapterAudioPlayableSrc({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    bookName: args.bookName,
    voiceId: args.voiceId,
  });
  if (resolved.ok) return resolved.src;

  return buildChapterAudioPlayableSrcSync({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    bookName: args.bookName,
    voiceId: args.voiceId,
  });
}
