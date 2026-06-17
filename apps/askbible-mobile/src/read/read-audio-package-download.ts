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

const inFlightChapterCacheKeys = new Set<string>();

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

  const key = chapterCacheKey(args);
  if (inFlightChapterCacheKeys.has(key)) return;
  inFlightChapterCacheKeys.add(key);

  InteractionManager.runAfterInteractions(() => {
    void (async () => {
      try {
        if (!(await isNetworkAvailable())) return;
        const existing = await resolveDownloadedChapterAudioUri(args);
        if (existing) return;

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
            return;
          } catch {
            /* try next candidate */
          }
        }
      } finally {
        inFlightChapterCacheKeys.delete(key);
      }
    })();
  });
}
