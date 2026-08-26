import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
import {
  resolveScriptureBundledModule,
  warmBundledScriptureChapterAudioUri,
} from "../audio/scriptureAudioPlayback";
import { normalizeShellMusicFileUri } from "../audio/shellMusicPlayableAssetUri";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { resolveScripturePlayableSrcForChapter } from "../bible/read-chapter-audio";
import { isMobileScriptureAudioStreamAllowed } from "../config/mobileBundledOnly";
import { scheduleChapterAudioBackgroundCache } from "../read/read-audio-package-download";
import { resolveDownloadedChapterAudioUri } from "../read/readAudioPackageDownloadPaths";
import { resolveStreamCachedChapterAudioUri } from "../read/readChapterAudioStreamCache";

function isRemoteHttpSrc(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}

function rememberRemoteForLaterCache(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
  remoteSrc: string;
}): void {
  scheduleChapterAudioBackgroundCache(args);
}

/**
 * iOS / Android 读经原生播放器：本地 file 优先；没有本地时直接返回 HTTPS，后台再落盘。
 * 顺序：包内 → 语音包目录 → 流式缓存 → 远端 URL（可先播）。
 */
export async function resolveIosNativeScriptureAssetUri(args: {
  src: string;
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<string | null> {
  if (!isNativeMainTrackOs()) return null;

  const voiceId = args.voiceId ?? (await readCuvChapterAudioVoice());
  const bundledModule = resolveScriptureBundledModule({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    voiceId,
  });
  if (bundledModule != null) {
    const warmed = await warmBundledScriptureChapterAudioUri(bundledModule);
    if (warmed) return normalizeShellMusicFileUri(warmed) || warmed;
  }

  const downloaded = await resolveDownloadedChapterAudioUri({
    translationId: args.translationId,
    voiceId,
    bookId: args.bookId,
    chapter: args.chapter,
  });
  if (downloaded) return normalizeShellMusicFileUri(downloaded) || downloaded;

  const streamed = await resolveStreamCachedChapterAudioUri({
    translationId: args.translationId,
    voiceId,
    bookId: args.bookId,
    chapter: args.chapter,
  });
  if (streamed) return normalizeShellMusicFileUri(streamed) || streamed;

  const raw = (args.src || "").trim();
  if (raw && (/^file:\/\//i.test(raw) || raw.startsWith("/"))) {
    return normalizeShellMusicFileUri(raw) || raw;
  }

  let remote = isRemoteHttpSrc(raw) ? raw : "";
  if (!remote) {
    if (!isMobileScriptureAudioStreamAllowed()) return null;
    remote =
      (
        await resolveScripturePlayableSrcForChapter({
          translationId: args.translationId,
          bookId: args.bookId,
          chapter: args.chapter,
          bookName: getScriptureBookDisplayName(args.bookId),
          voiceId,
        })
      )?.trim() ?? "";
  }
  if (!isRemoteHttpSrc(remote)) return null;
  if (!isMobileScriptureAudioStreamAllowed()) return null;

  rememberRemoteForLaterCache({
    translationId: args.translationId,
    voiceId,
    bookId: args.bookId,
    chapter: args.chapter,
    remoteSrc: remote,
  });
  return remote;
}
