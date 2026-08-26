import { InteractionManager } from "react-native";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { buildChapterAudioDownloadCandidates } from "../bible/chapter-audio-sources";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import {
  chapterCacheKey,
  resolveDownloadedChapterAudioUri,
} from "./readAudioPackageDownloadPaths";
import {
  downloadChapterAudioToStreamCache,
  purgeExpiredChapterAudioStreamCache,
} from "./readChapterAudioStreamCache";
import {
  pauseAudioPackageDownload,
  resumeAudioPackageDownload,
  startAudioPackageDownload,
} from "./readAudioPackageDownloadRun";
import {
  ensureAudioPackageDownloadHydrated,
  readAudioPackageDownloadState,
  subscribeAudioPackageDownload,
} from "./readAudioPackageDownloadStore";

export type { AudioPackageDownloadState, AudioPackageSelection } from "./readAudioPackageDownloadStore";

export {
  chapterAudioPackageKey,
  resolveDownloadedChapterAudioUri,
} from "./readAudioPackageDownloadPaths";

export {
  ensureAudioPackageDownloadHydrated,
  pauseAudioPackageDownload,
  readAudioPackageDownloadState,
  resumeAudioPackageDownload,
  startAudioPackageDownload,
  subscribeAudioPackageDownload,
};

export { purgeExpiredChapterAudioStreamCache } from "./readChapterAudioStreamCache";

const inFlightChapterDownloads = new Map<string, Promise<string | null>>();

async function downloadChapterAudioToCacheInner(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
  remoteSrc: string;
}): Promise<string | null> {
  const remote = args.remoteSrc.trim();
  if (!remote || !/^https?:\/\//i.test(remote)) return null;
  if (!(await isNetworkAvailable())) return null;

  const existing = await resolveDownloadedChapterAudioUri(args);
  if (existing) return existing;

  const baseUrl = getAskBibleBaseUrl();
  const candidates = buildChapterAudioDownloadCandidates({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    voiceId: args.voiceId,
    siteBaseUrl: baseUrl,
  });

  return downloadChapterAudioToStreamCache({
    translationId: args.translationId,
    voiceId: args.voiceId,
    bookId: args.bookId,
    chapter: args.chapter,
    remoteSrc: remote,
    candidateUrls: candidates,
  });
}

/** 下载远程章朗读到「流式缓存」（10 天未访问清理）；完整语音包目录不受影响。 */
export async function downloadChapterAudioToCache(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
  remoteSrc: string;
}): Promise<string | null> {
  const key = chapterCacheKey(args);
  const pending = inFlightChapterDownloads.get(key);
  if (pending) return pending;

  const work = downloadChapterAudioToCacheInner(args);
  inFlightChapterDownloads.set(key, work);
  try {
    return await work;
  } finally {
    if (inFlightChapterDownloads.get(key) === work) {
      inFlightChapterDownloads.delete(key);
    }
  }
}

/** 首章开播后再落盘，避免和 AVPlayer 抢同一条网。 */
const PLAYING_CHAPTER_CACHE_DELAY_MS = 8_000;

/** 远程章朗读边播边存到流式缓存目录（章页点播 / 今日读经共用）。 */
export function scheduleChapterAudioBackgroundCache(
  args: {
    translationId: string;
    voiceId: CuvChapterAudioVoiceId;
    bookId: string;
    chapter: number;
    remoteSrc: string;
  },
  opts?: { delayMs?: number },
): void {
  const remote = args.remoteSrc.trim();
  if (!remote || !/^https?:\/\//i.test(remote)) return;

  const delayMs = opts?.delayMs ?? PLAYING_CHAPTER_CACHE_DELAY_MS;
  const start = () => {
    InteractionManager.runAfterInteractions(() => {
      void purgeExpiredChapterAudioStreamCache();
      void downloadChapterAudioToCache(args);
    });
  };
  if (delayMs > 0) {
    setTimeout(start, delayMs);
    return;
  }
  start();
}
