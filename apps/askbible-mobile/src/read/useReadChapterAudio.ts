import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { InteractionManager, type ScrollView } from "react-native";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import type { LoadedChapter } from "../bible/types";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { useScriptureFollowDerived } from "./useScriptureFollowDerived";
import {
  getScripturePlayingChapter,
  subscribeScripturePlayingChapter,
} from "../music/scripturePlayingChapterStore";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import {
  ensurePlanFlowChapterAudioReady,
  prefetchUpcomingPlanFlowChapterAudio,
} from "./prefetch-plan-flow-chapter-audio";
import { setPlanFlowUiHost } from "./read-plan-flow-autoplay";
import { useReadChapterAudioRegistration } from "./useReadChapterAudioRegistration";

type ChapterTarget = { bookId: string; chapter: number };

export type UseReadChapterAudioOptions = {
  scrollHeaderHeightRef?: React.RefObject<number>;
  onAdvanceChapter?: (target: ChapterTarget | null) => void;
  isPlanFlow?: boolean;
  planFlowTick?: string | null;
  planFlowQueue?: Array<{ bookId: string; chapter: number }>;
};

/**
 * 读经音频：注册音轨、邻章预取、近结尾检测。
 * 播经跟读高亮 + 自动滚到屏幕中间已移除（易错位且 120ms 跟读态会抬高 JS CPU）。
 * 用户「划重点」与搜索定位滚屏仍由其它 hook 负责。
 */
export function useReadChapterAudio(
  chapterData: LoadedChapter | null,
  _scrollRef: React.RefObject<ScrollView | null>,
  options: UseReadChapterAudioOptions = {},
) {
  const {
    onAdvanceChapter,
    isPlanFlow = false,
    planFlowTick = null,
    planFlowQueue = [],
  } = options;
  const {
    registerReadChapter,
    playing,
    playbackMode,
    scriptureDurationSec,
  } = useMusicPlayback();
  const playingAudioChapter = useSyncExternalStore(
    subscribeScripturePlayingChapter,
    getScripturePlayingChapter,
    getScripturePlayingChapter,
  );
  const registerReadChapterRef = useRef(registerReadChapter);
  registerReadChapterRef.current = registerReadChapter;

  const { audioVoiceId, chapterAudioTranslationId } = useReadBibleTypography();
  const isFocused = useIsFocused();

  // 章页聚焦时退出 listen 宿主，避免坞/中央键仍按计划池续播。
  useEffect(() => {
    if (!isFocused) return;
    setPlanFlowUiHost("chapter");
  }, [isFocused]);

  const supported = chapterData ? translationSupportsChapterAudio(chapterAudioTranslationId) : false;

  const chapterAudioKey = useMemo(() => {
    if (!chapterData) return null;
    return `${chapterData.bookId}:${chapterData.chapter}:${chapterAudioTranslationId}:${audioVoiceId}`;
  }, [chapterData, chapterAudioTranslationId, audioVoiceId]);

  const { chapterAudioSrc } = useReadChapterAudioRegistration({
    chapterData,
    chapterAudioKey,
    chapterAudioTranslationId,
    audioVoiceId,
    isPlanFlow,
    planFlowTick: planFlowTick ?? null,
    registerReadChapterRef,
    onAdvanceChapter,
  });

  const audioBoundToDisplayedChapter =
    !!chapterData &&
    !!playingAudioChapter &&
    playingAudioChapter.bookId === chapterData.bookId &&
    playingAudioChapter.chapter === chapterData.chapter &&
    playingAudioChapter.translationId === chapterAudioTranslationId;

  useEffect(() => {
    if (!chapterData || !supported || !isFocused) return;

    if (planFlowQueue.length > 0) {
      prefetchUpcomingPlanFlowChapterAudio(
        planFlowQueue,
        { bookId: chapterData.bookId, chapter: chapterData.chapter },
        {
          translationId: chapterAudioTranslationId,
          voiceId: audioVoiceId,
          ahead: 3,
        },
      );
      return;
    }

    const { next, prev } = resolveReadChapterNeighbors(chapterData.bookId, chapterData.chapter);
    const neighbors = [next, prev].filter(
      (target): target is NonNullable<typeof next> => Boolean(target),
    );
    if (!neighbors.length) return;
    // 邻章预取让开开播前几秒，少和进度轴 / 首屏布局抢 JS。
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (cancelled) return;
        for (const target of neighbors) {
          void ensurePlanFlowChapterAudioReady({
            ref: { bookId: target.bookId, chapter: target.chapter },
            translationId: chapterAudioTranslationId,
            voiceId: audioVoiceId,
            streamFirst: false,
          });
        }
      }, 2800);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [
    audioVoiceId,
    chapterAudioTranslationId,
    chapterData,
    isFocused,
    planFlowQueue,
    supported,
  ]);

  const audioMatchesChapter =
    audioBoundToDisplayedChapter &&
    supported &&
    Boolean(chapterAudioSrc) &&
    playbackMode === "scripture" &&
    playing;
  const scriptureBoundToCurrentChapter =
    audioBoundToDisplayedChapter &&
    supported &&
    Boolean(chapterAudioSrc) &&
    playbackMode === "scripture";
  const nearAudioEnd = useScriptureFollowDerived(
    (sec) =>
      scriptureBoundToCurrentChapter &&
      scriptureDurationSec > 0 &&
      sec >= Math.max(0, scriptureDurationSec - 1.2),
  );

  return {
    supported,
    chapterAudioAvailable: Boolean(chapterAudioSrc),
    /** 跟读高亮已关闭；保留字段以免改动整条经文列表 props。 */
    activeVerseIndex: null as number | null,
    audioMatchesChapter,
    nearAudioEnd,
  };
}
