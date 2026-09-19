import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { InteractionManager, type ScrollView } from "react-native";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import type { LoadedChapter } from "../bible/types";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { useScriptureFollowDerived } from "./useScriptureFollowDerived";
import { loadBundledChapterVerseTimings } from "../bible/bundled-verse-timings";
import { activeVerseProgressAt } from "./verse-timing-lookup";
import { verseSentenceIndexAt } from "./verse-sentences";
import {
  buildChapterSentenceIndex,
  decodeFollowKey,
  encodeFollowKey,
} from "./read-chapter-follow-sentences";
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

type UseReadChapterAudioOptions = {
  scrollHeaderHeightRef?: React.RefObject<number>;
  onAdvanceChapter?: (target: ChapterTarget | null) => void;
  isPlanFlow?: boolean;
  planFlowTick?: string | null;
  planFlowQueue?: Array<{ bookId: string; chapter: number }>;
};

/**
 * 读经音频：注册音轨、邻章预取、近结尾检测、跟读高亮。
 *
 * 跟读高亮曾被整个摘掉（「易错位且 120ms 跟读态会抬高 JS CPU」），2026-09-19 重开，
 * 两个老毛病分别这么绕开：
 * - **错位**：时间轴只对得上和合本 / WEB / 潮州语，认不出的译本 `loadBundled…` 返回 null，
 *   没有时间轴就不高亮（Josh 2026-09-11 定的「没有时间点就不高亮」）。
 * - **CPU**：派生值是一个字符串 `节号:句下标`，`useSyncExternalStore` 快照不变就跳过重渲染。
 *   秒数每 120ms 推一次，但句几秒才换一次，实际重渲染频率比原来的「按节」还低。
 *   句切分表在 `useMemo` 里切一次缓存住，派生函数里只做二分 + 累加。
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
    playScriptureChapter,
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

  // 正在播这一章但译本对不上（用户中途切了阅读译本）：用新译本重开，而不是让旧译本音频一直播下去。
  // playingAudioChapter 一旦随新音轨更新为目标译本，下面的条件自然不再成立，不会死循环。
  useEffect(() => {
    if (!chapterData || !supported || !playbackMode || playbackMode !== "scripture") return;
    if (!playingAudioChapter) return;
    if (
      playingAudioChapter.bookId !== chapterData.bookId ||
      playingAudioChapter.chapter !== chapterData.chapter ||
      playingAudioChapter.translationId === chapterAudioTranslationId
    ) {
      return;
    }
    void playScriptureChapter({
      bookId: chapterData.bookId,
      chapter: chapterData.chapter,
      bookName: getScriptureBookDisplayName(chapterData.bookId),
      translationId: chapterAudioTranslationId,
    });
  }, [
    chapterData,
    supported,
    playbackMode,
    playingAudioChapter,
    chapterAudioTranslationId,
    playScriptureChapter,
  ]);

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

  // 跟读时间轴：认不出的译本返回 null —— 没有时间点就不高亮，宁可不亮也不要错位
  const followTimings = useMemo(() => {
    if (!chapterData || !supported) return null;
    return loadBundledChapterVerseTimings(
      chapterAudioTranslationId,
      audioVoiceId,
      chapterData.bookId,
      chapterData.chapter,
    );
  }, [audioVoiceId, chapterAudioTranslationId, chapterData, supported]);

  // 句切分表：整章切一次缓存住，派生函数里不许重切
  const sentenceIndex = useMemo(
    () => buildChapterSentenceIndex(chapterData?.verses),
    [chapterData],
  );

  const followKey = useScriptureFollowDerived((sec) => {
    if (!scriptureBoundToCurrentChapter || !followTimings?.length) return "";
    const hit = activeVerseProgressAt(sec, followTimings);
    if (!hit) return "";
    const entry = sentenceIndex.get(hit.verse);
    if (!entry) return "";
    return encodeFollowKey(hit.verse, verseSentenceIndexAt(hit.progress, entry.weights));
  });

  const follow = useMemo(
    () => decodeFollowKey(followKey, sentenceIndex),
    [followKey, sentenceIndex],
  );

  // 节号 → 列表下标（整条经文列表按下标比对）
  const activeVerseIndex = useMemo(() => {
    if (!follow || !chapterData) return null;
    const i = chapterData.verses.findIndex((v) => v.verse === follow.verse);
    return i >= 0 ? i : null;
  }, [chapterData, follow]);

  return {
    supported,
    chapterAudioAvailable: Boolean(chapterAudioSrc),
    activeVerseIndex,
    /** 当前正在读的那一句在节正文里的字符区间；没有时间轴或切不出句时为 null */
    activeSentence: follow?.sentence ?? null,
    audioMatchesChapter,
    nearAudioEnd,
  };
}
