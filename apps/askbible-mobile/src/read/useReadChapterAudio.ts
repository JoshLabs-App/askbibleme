import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, type ScrollView } from "react-native";
import {
  chapterAudioVerseSyncTranslationId,
  fetchChapterVerseTimings,
  verseIndexForVerseNumber,
  verseNumberAtChapterAudioTime,
  type CuvChapterVerseTiming,
} from "../bible/cuv-chapter-verse-timings";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import {
  prefetchScriptureChapterAudioSrc,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import {
  verseIndexForReadChapterAudioTime,
  verseWeightsForReadChapterAudio,
} from "../bible/read-chapter-audio-verse-from-progress";
import type { LoadedChapter } from "../bible/types";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import {
  useMusicPlayback,
  useScripturePlaybackSec,
} from "../music/MusicPlaybackContext";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import {
  useReadChapterAudioScrollFollow,
  type ReadChapterAudioScrollFollowOpts,
} from "./useReadChapterAudioScrollFollow";
import { prefetchUpcomingPlanFlowChapterAudio } from "./prefetch-plan-flow-chapter-audio";
import { useReadChapterAudioRegistration } from "./useReadChapterAudioRegistration";

type ChapterTarget = { bookId: string; chapter: number };

export type UseReadChapterAudioOptions = {
  scrollHeaderHeightRef?: React.RefObject<number>;
  onAdvanceChapter?: (target: ChapterTarget) => void;
  isPlanFlow?: boolean;
  planFlowTick?: string | null;
  planFlowQueue?: Array<{ bookId: string; chapter: number }>;
  followScroll?: ReadChapterAudioScrollFollowOpts;
};

export function useReadChapterAudio(
  chapterData: LoadedChapter | null,
  scrollRef: React.RefObject<ScrollView | null>,
  options: UseReadChapterAudioOptions = {},
) {
  const {
    onAdvanceChapter,
    isPlanFlow = false,
    planFlowTick = null,
    planFlowQueue = [],
    followScroll,
  } = options;
  const {
    registerReadChapter,
    playing,
    playbackMode,
    scriptureDurationSec,
    scripturePreparing,
  } = useMusicPlayback();
  const scripturePlaybackSec = useScripturePlaybackSec();
  const registerReadChapterRef = useRef(registerReadChapter);
  registerReadChapterRef.current = registerReadChapter;

  const [verseTimings, setVerseTimings] = useState<CuvChapterVerseTiming[] | null>(null);
  const [weightVerses, setWeightVerses] = useState<readonly { text: string }[] | null>(null);
  const baseUrl = useMemo(() => getAskBibleBaseUrl(), []);
  const { audioVoiceId, chapterAudioTranslationId } = useReadBibleTypography();
  const isFocused = useIsFocused();

  const supported = chapterData ? translationSupportsChapterAudio(chapterAudioTranslationId) : false;
  const verseSyncTranslationId = useMemo(
    () => chapterAudioVerseSyncTranslationId(chapterAudioTranslationId, audioVoiceId),
    [audioVoiceId, chapterAudioTranslationId],
  );

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
    const task = InteractionManager.runAfterInteractions(() => {
      for (const target of neighbors) {
        void prefetchScriptureChapterAudioSrc({
          translationId: chapterAudioTranslationId,
          bookId: target.bookId,
          chapter: target.chapter,
          bookName: target.bookName,
          voiceId: audioVoiceId,
        });
      }
    });
    return () => task.cancel();
  }, [
    audioVoiceId,
    chapterAudioTranslationId,
    chapterData,
    isFocused,
    planFlowQueue,
    supported,
  ]);

  useEffect(() => {
    if (!chapterData || !supported) {
      setVerseTimings(null);
      return;
    }
    const needsTimings = playbackMode === "scripture" && (playing || scripturePreparing);
    if (!needsTimings || !isFocused) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const timings = await fetchChapterVerseTimings(
          baseUrl,
          chapterAudioTranslationId,
          audioVoiceId,
          chapterData.bookId,
          chapterData.chapter,
        );
        if (!cancelled) setVerseTimings(timings);
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    audioVoiceId,
    baseUrl,
    chapterAudioTranslationId,
    chapterData,
    supported,
    verseSyncTranslationId,
    playbackMode,
    playing,
    scripturePreparing,
    isFocused,
  ]);

  useEffect(() => {
    if (!chapterData || !supported) {
      setWeightVerses(null);
      return;
    }
    const needsWeights = playbackMode === "scripture" && (playing || scripturePreparing);
    if (!needsWeights || !isFocused) return;
    if (verseSyncTranslationId === chapterData.translationId) {
      setWeightVerses(chapterData.verses);
      return;
    }
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadChapterFromBundledTranslation(
        chapterData.bookId,
        chapterData.chapter,
        verseSyncTranslationId,
      ).then((loaded) => {
        if (cancelled) return;
        setWeightVerses(loaded?.verses ?? chapterData.verses);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    chapterData,
    chapterData?.bookId,
    chapterData?.chapter,
    chapterData?.translationId,
    chapterData?.verses,
    supported,
    verseSyncTranslationId,
    playbackMode,
    playing,
    scripturePreparing,
    isFocused,
  ]);

  const weights = useMemo(
    () => (weightVerses ? verseWeightsForReadChapterAudio(weightVerses) : []),
    [weightVerses],
  );

  const audioMatchesChapter =
    supported && Boolean(chapterAudioSrc) && playbackMode === "scripture" && playing;
  const audioFollowActive =
    supported && Boolean(chapterAudioSrc) && playbackMode === "scripture" && (playing || scripturePreparing);
  const scriptureBoundToCurrentChapter =
    supported && Boolean(chapterAudioSrc) && playbackMode === "scripture";
  const nearAudioEnd =
    scriptureBoundToCurrentChapter &&
    scriptureDurationSec > 0 &&
    scripturePlaybackSec >= Math.max(0, scriptureDurationSec - 1.2);

  const activeVerseIndex = (() => {
    if (!chapterData || !audioFollowActive) return null;
    if (verseTimings?.length) {
      const verseNum = verseNumberAtChapterAudioTime(scripturePlaybackSec, verseTimings);
      if (verseNum === null) return null;
      return verseIndexForVerseNumber(chapterData.verses, verseNum);
    }
    if (weights.length > 0) {
      if (!Number.isFinite(scriptureDurationSec) || scriptureDurationSec <= 0.05) {
        return 0;
      }
      return verseIndexForReadChapterAudioTime(
        scripturePlaybackSec,
        scriptureDurationSec,
        weights,
      );
    }
    return null;
  })();

  useReadChapterAudioScrollFollow({
    scrollRef,
    followScroll: {
      ...followScroll,
      audioDockVisible: Boolean(chapterAudioSrc),
    },
    isFocused,
    activeVerseIndex,
    chapterVerses: chapterData?.verses,
    audioFollowActive,
    chapterKey: chapterData ? `${chapterData.bookId}:${chapterData.chapter}` : null,
    scripturePlaybackSec,
  });

  return {
    supported,
    chapterAudioAvailable: Boolean(chapterAudioSrc),
    activeVerseIndex,
    audioMatchesChapter,
    nearAudioEnd,
  };
}
