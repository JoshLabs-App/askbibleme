import * as FileSystem from "expo-file-system/legacy";
import { InteractionManager } from "react-native";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { buildChapterAudioDownloadCandidates } from "../bible/chapter-audio-sources";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import {
  chapterAudioPackageKey,
  chapterCacheKey,
  chapterFileUri,
  ensurePackageDir,
  resolveDownloadedChapterAudioUri,
} from "./readAudioPackageDownloadPaths";
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

  const packageKey = chapterAudioPackageKey({
    translationId: args.translationId,
    voiceId: args.voiceId,
  });
  await ensurePackageDir(packageKey);
  const target = chapterFileUri(packageKey, args.bookId, args.chapter);
  const tmp = `${target}.download`;
  const baseUrl = getAskBibleBaseUrl();
  const candidates = buildChapterAudioDownloadCandidates({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
    voiceId: args.voiceId,
    siteBaseUrl: baseUrl,
  });
  const urls = [remote, ...candidates.filter((u) => u.trim() && u !== remote)];

  for (const url of urls) {
    try {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
      const result = await FileSystem.downloadAsync(url, tmp);
      if (!result?.uri || result.status < 200 || result.status >= 300) continue;
      const info = await FileSystem.getInfoAsync(tmp);
      if (!info.exists || typeof info.size !== "number" || info.size <= 0) continue;
      await FileSystem.deleteAsync(target, { idempotent: true });
      await FileSystem.moveAsync({ from: tmp, to: target });
      return target;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/** 下载远程章朗读到本地缓存目录；已存在则直接返回本地 URI。 */
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

/** 远程章朗读边播边存到与「朗读音频下载」相同目录。 */
export function scheduleChapterAudioBackgroundCache(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
  remoteSrc: string;
}): void {
  const remote = args.remoteSrc.trim();
  if (!remote || !/^https?:\/\//i.test(remote)) return;

  InteractionManager.runAfterInteractions(() => {
    void downloadChapterAudioToCache(args);
  });
}
