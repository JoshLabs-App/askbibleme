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
import { useReadChapterAudioRegistration } from "./useReadChapterAudioRegistration";

type ChapterTarget = { bookId: string; chapter: number };

export function useReadChapterAudio(
  chapterData: LoadedChapter | null,
  scrollRef: React.RefObject<ScrollView | null>,
  scrollHeaderHeightRef?: React.RefObject<number>,
  onAdvanceChapter?: (target: ChapterTarget) => void,
  followScroll?: ReadChapterAudioScrollFollowOpts,
) {
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
    registerReadChapterRef,
    onAdvanceChapter,
  });

  useEffect(() => {
    if (!chapterData || !supported || !isFocused) return;
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
  const scriptureBoundToCurrentChapter =
    supported && Boolean(chapterAudioSrc) && playbackMode === "scripture";
  const nearAudioEnd =
    scriptureBoundToCurrentChapter &&
    scriptureDurationSec > 0 &&
    scripturePlaybackSec >= Math.max(0, scriptureDurationSec - 1.2);

  const activeVerseIndex = (() => {
    if (!chapterData || !audioMatchesChapter) return null;
    if (verseTimings?.length) {
      const verseNum = verseNumberAtChapterAudioTime(scripturePlaybackSec, verseTimings);
      if (verseNum === null) return null;
      return verseIndexForVerseNumber(chapterData.verses, verseNum);
    }
    return verseIndexForReadChapterAudioTime(
      scripturePlaybackSec,
      scriptureDurationSec,
      weights,
    );
  })();

  useReadChapterAudioScrollFollow({
    scrollRef,
    scrollHeaderHeightRef,
    followScroll,
    isFocused,
    activeVerseIndex,
    chapterVerses: chapterData?.verses,
    audioMatchesChapter,
  });

  return {
    supported,
    chapterAudioAvailable: Boolean(chapterAudioSrc),
    activeVerseIndex,
    audioMatchesChapter,
    nearAudioEnd,
  };
}
