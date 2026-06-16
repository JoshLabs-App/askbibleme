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
import {
  resolveDownloadedChapterAudioUri,
  scheduleChapterAudioBackgroundCache,
} from "../read/read-audio-package-download";
import { isMobileScriptureAudioStreamAllowed } from "../config/mobileBundledOnly";

function scriptureChapterAudioCacheKey(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): string {
  return `${args.translationId}:${args.bookId}:${args.chapter}:${args.voiceId ?? "mandarin"}`;
}

const resolvedSrcPrefetch = new Map<string, string>();

/** 空闲时预解析下一章音频 URL，不创建 Sound、不播放。 */
export async function prefetchScriptureChapterAudioSrc(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  bookName: string;
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<void> {
  const key = scriptureChapterAudioCacheKey(args);
  if (resolvedSrcPrefetch.has(key)) return;
  const src = await resolveScripturePlayableSrcForChapter(args);
  if (src) resolvedSrcPrefetch.set(key, src);
}

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

/** 同步拼出可播 URL：安装包内置章朗读（若有）。 */
export function buildChapterAudioPlayableSrcSync(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  bookName: string;
  voiceId?: CuvChapterAudioVoiceId;
  baseUrl?: string;
}): string | null {
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

/** 读经章播放：本地下载包 → 安装包内置 → 联网（FHL 闫大卫 / 自托管，未下载时流式）。 */
export async function resolveScripturePlayableSrcForChapter(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  bookName: string;
  voiceId?: CuvChapterAudioVoiceId;
  cachedSrc?: string | null;
}): Promise<string | null> {
  const cacheKey = scriptureChapterAudioCacheKey(args);
  const downloaded = await resolveDownloadedChapterAudioUri({
    translationId: args.translationId,
    voiceId: args.voiceId ?? "mandarin",
    bookId: args.bookId,
    chapter: args.chapter,
  });
  if (downloaded) {
    resolvedSrcPrefetch.set(cacheKey, downloaded);
    return downloaded;
  }

  const prefetched = resolvedSrcPrefetch.get(cacheKey);
  if (prefetched) return prefetched;

  const cached = args.cachedSrc?.trim();
  if (cached && !shouldIgnoreCachedScriptureSrc(cached, args.translationId)) return cached;
  if (!translationSupportsChapterAudio(args.translationId)) return null;

  const bundledSync = buildChapterAudioPlayableSrcSync({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    bookName: args.bookName,
    voiceId: args.voiceId,
  });
  if (bundledSync) {
    resolvedSrcPrefetch.set(cacheKey, bundledSync);
    return bundledSync;
  }
  if (!isMobileScriptureAudioStreamAllowed()) return null;

  const resolved = await resolveChapterAudioPlayableSrc({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    bookName: args.bookName,
    voiceId: args.voiceId,
  });
  if (resolved.ok) {
    if (isMobileScriptureAudioStreamAllowed() && /^https?:\/\//i.test(resolved.src)) {
      scheduleChapterAudioBackgroundCache({
        translationId: args.translationId,
        voiceId: args.voiceId ?? "mandarin",
        bookId: args.bookId,
        chapter: args.chapter,
        remoteSrc: resolved.src,
      });
    }
    resolvedSrcPrefetch.set(cacheKey, resolved.src);
    return resolved.src;
  }

  const fallback = buildChapterAudioPlayableSrcSync({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    bookName: args.bookName,
    voiceId: args.voiceId,
  });
  if (fallback) resolvedSrcPrefetch.set(cacheKey, fallback);
  return fallback;
}
