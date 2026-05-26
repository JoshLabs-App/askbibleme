import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import {
  absoluteSelfHostedChapterAudioUrl,
  getChapterAudioBaseUrl,
} from "./chapter-audio-url";
import { resolveBundledChapterAudioUri } from "./bundled-chapter-audio";
import {
  buildExternalCuvChapterAudioUrl,
  buildLocalCuvChapterAudioUrl,
  buildLocalTeochewNtChapterAudioUrl,
  resolveCuvChapterAudioPlayableSrc,
  translationSupportsCuvChapterAudio,
} from "./cuv-chapter-audio";
import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";
import { effectiveVoiceForBook } from "./cuv-chapter-audio-voices";
import { scriptureBooks } from "./scripture-books";
import {
  buildExternalWebChapterAudioUrl,
  buildLocalWebChapterAudioUrl,
  resolveWebChapterAudioPlayableSrc,
  translationUsesWebChapterAudio,
} from "./web-chapter-audio";
import { resolveDownloadedChapterAudioUri } from "../read/read-audio-package-download";

function shouldIgnoreCachedScriptureSrc(cachedSrc: string, translationId: string): boolean {
  const src = cachedSrc.trim().toLowerCase();
  if (!src) return true;
  // CUV 历史外链在部分章节会 404；开发态优先重算更稳的 askbible 自托管链接。
  if (
    translationSupportsCuvChapterAudio(translationId) &&
    src.includes("theaudiopower.org/cuv/recordings/")
  ) {
    return true;
  }
  return false;
}

function cuvRemoteBookName(bookId: string, bookName: string): string {
  const meta = scriptureBooks.find((b) => b.bookId === String(bookId || "").trim().toUpperCase());
  return meta?.bookName ?? bookName;
}

/** 同步拼出可播 URL（不探测网络），供注册与 Android 播放兜底 */
export function buildChapterAudioPlayableSrcSync(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  bookName: string;
  voiceId?: CuvChapterAudioVoiceId;
  baseUrl?: string;
}): string | null {
  const baseUrl = args.baseUrl ?? getChapterAudioBaseUrl();

  const bundled = isMobileBundledOnly()
    ? resolveBundledChapterAudioUri({
        translationId: args.translationId,
        bookId: args.bookId,
        chapter: args.chapter,
        voiceId: args.voiceId,
      })
    : null;
  if (bundled) return bundled;

  if (translationUsesWebChapterAudio(args.translationId)) {
    const remote = buildExternalWebChapterAudioUrl(args.bookId, args.chapter);
    const local = buildLocalWebChapterAudioUrl(args.bookId, args.chapter);
    if (!local) return remote || null;
    const trusted = absoluteSelfHostedChapterAudioUrl(baseUrl, local);
    const askBibleFallback = toAbsoluteUrl("https://askbible.me", local);
    return trusted || askBibleFallback || remote || null;
  }

  if (!translationSupportsCuvChapterAudio(args.translationId)) return null;

  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);
  if (voice === "teochew-nt") {
    const teochewLocal = buildLocalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
    if (!teochewLocal) return null;
    const selfHosted = absoluteSelfHostedChapterAudioUrl(baseUrl, teochewLocal);
    if (selfHosted) return selfHosted;
    return toAbsoluteUrl("https://askbible.me", teochewLocal) || null;
  }

  const local = buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  if (!local) return null;

  const remote = buildExternalCuvChapterAudioUrl(
    cuvRemoteBookName(args.bookId, args.bookName),
    args.chapter,
  );

  const trusted = absoluteSelfHostedChapterAudioUrl(baseUrl, local);
  if (trusted) return trusted;
  const askBibleFallback = toAbsoluteUrl("https://askbible.me", local);
  return askBibleFallback || remote || null;
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

/** 读经章播放：优先缓存 URL，否则异步解析（含 WEB 外链 / CUV 自托管） */
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
