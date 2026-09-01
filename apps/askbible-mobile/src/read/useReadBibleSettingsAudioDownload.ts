import { useCallback, useEffect, useMemo, useState } from "react";
import type { MutableRefObject } from "react";
import { InteractionManager } from "react-native";
import { decodeChapterAudioPlaybackOptionId } from "./read-chapter-audio-playback-options";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { translationUsesWebChapterAudio } from "../bible/web-chapter-audio";
import { translationHasVerifiedYouVersionChapterAudio } from "@/lib/bible/youversion-chapter-audio";
import {
  chapterAudioPackageKey,
  ensureAudioPackageDownloadHydrated,
  pauseAudioPackageDownload,
  readAudioPackageDownloadState,
  resumeAudioPackageDownload,
  startAudioPackageDownload,
  subscribeAudioPackageDownload,
} from "./read-audio-package-download";
import type { AppLocale } from "../i18n/config";
import type { ReadBibleSettingsOpenMenu } from "./useReadBibleSettingsTranslationOptions";

export type AudioDownloadPackageItem = {
  packageKey: string;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  label: string;
};

type Args = {
  locale: AppLocale;
  localeZhText: (text: string) => string;
  openMenuRef: MutableRefObject<ReadBibleSettingsOpenMenu>;
  chapterAudioPlaybackValue: string;
  playbackDisplay: string;
};

export function useReadBibleSettingsAudioDownload({
  locale,
  localeZhText,
  openMenuRef,
  chapterAudioPlaybackValue,
  playbackDisplay,
}: Args) {
  const [downloadState, setDownloadState] = useState(() => readAudioPackageDownloadState());

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void ensureAudioPackageDownloadHydrated();
    });
    const unsub = subscribeAudioPackageDownload(() => {
      if (openMenuRef.current) return;
      setDownloadState(readAudioPackageDownloadState());
    });
    return () => {
      task.cancel();
      unsub();
    };
  }, [openMenuRef]);

  const downloadTarget = useMemo(() => {
    const picked = decodeChapterAudioPlaybackOptionId(chapterAudioPlaybackValue);
    if (picked.audioTranslationId && translationUsesWebChapterAudio(picked.audioTranslationId)) {
      return {
        translationId: picked.audioTranslationId,
        voiceId: "mandarin" as const,
      };
    }
    return {
      translationId: "cuv-simp",
      voiceId: picked.voiceId,
    };
  }, [chapterAudioPlaybackValue]);
  const audioPackageDownloadAvailable = !translationHasVerifiedYouVersionChapterAudio(
    chapterAudioPlaybackValue,
  );

  const activePackageKey = useMemo(
    () =>
      chapterAudioPackageKey({
        translationId: downloadTarget.translationId,
        voiceId: downloadTarget.voiceId,
      }),
    [downloadTarget.translationId, downloadTarget.voiceId],
  );
  const downloadPercent = downloadState.total
    ? Math.floor(((downloadState.completed + downloadState.currentPercent) / downloadState.total) * 100)
    : 0;

  const currentDownloadPackage = useMemo(
    (): AudioDownloadPackageItem => ({
      packageKey: activePackageKey,
      translationId: downloadTarget.translationId,
      voiceId: downloadTarget.voiceId,
      label: playbackDisplay || (locale === "en" ? "Chapter audio" : localeZhText("朗读音频")),
    }),
    [
      activePackageKey,
      downloadTarget.translationId,
      downloadTarget.voiceId,
      playbackDisplay,
      locale,
      localeZhText,
    ],
  );

  const downloadButtonText = useCallback(
    (pkg: AudioDownloadPackageItem): string => {
      const active = downloadState.packageKey === pkg.packageKey;
      if (active && downloadState.status === "running") {
        return locale === "en" ? `Downloading ${downloadPercent}%` : `${localeZhText("下载中")} ${downloadPercent}%`;
      }
      if (active && downloadState.status === "paused") {
        return locale === "en" ? "Resume" : localeZhText("继续");
      }
      if (active && downloadState.status === "done") {
        return locale === "en" ? "Downloaded" : localeZhText("已下载");
      }
      if (active && downloadState.status === "error") {
        return locale === "en" ? "Retry" : localeZhText("重试");
      }
      return locale === "en" ? "Download" : localeZhText("下载");
    },
    [downloadState.packageKey, downloadState.status, downloadPercent, locale, localeZhText],
  );

  const downloadActionMeta = useMemo(() => {
    const active = downloadState.packageKey === currentDownloadPackage.packageKey;
    const status = active ? downloadState.status : "idle";
    if (status === "running") {
      return {
        icon: "pause-circle-filled" as const,
        color: c.parchmentAccent,
      };
    }
    if (status === "done") {
      return {
        icon: "check-circle" as const,
        color: "#7EA26B",
      };
    }
    if (status === "paused" || status === "error") {
      return {
        icon: "play-circle-filled" as const,
        color: c.parchmentAccent,
      };
    }
    return {
      icon: "download" as const,
      color: c.faint,
    };
  }, [downloadState.packageKey, downloadState.status, currentDownloadPackage.packageKey]);

  const onDownloadPackage = useCallback(
    (pkg: AudioDownloadPackageItem) => {
      const active = downloadState.packageKey === pkg.packageKey;
      if (active && downloadState.status === "running") {
        void pauseAudioPackageDownload();
        return;
      }
      if (active && (downloadState.status === "paused" || downloadState.status === "error")) {
        void resumeAudioPackageDownload({
          translationId: pkg.translationId,
          voiceId: pkg.voiceId,
          label: pkg.label,
        });
        return;
      }
      void startAudioPackageDownload({
        translationId: pkg.translationId,
        voiceId: pkg.voiceId,
        label: pkg.label,
      });
    },
    [downloadState.packageKey, downloadState.status],
  );

  return {
    audioPackageDownloadAvailable,
    currentDownloadPackage,
    downloadActionMeta,
    downloadButtonText,
    onDownloadPackage,
  };
}
