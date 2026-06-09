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
  buildChapterAudioPlayableSrcSync,
  prefetchScriptureChapterAudioSrc,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import {
  verseIndexForReadChapterAudioTime,
  verseWeightsForReadChapterAudio,
} from "../bible/read-chapter-audio-verse-from-progress";
import type { LoadedChapter } from "../bible/types";
import { getChapterAudioBaseUrl } from "../bible/chapter-audio-url";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import {
  resolveReadChapterAudioRegistration,
  useMusicPlayback,
  useScripturePlaybackSec,
} from "../music/MusicPlaybackContext";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import {
  isVerseVisibleInScrollViewport,
  scrollYToCenterVerse,
  type VerseLayout,
} from "./read-chapter-verse-layout";

type ChapterTarget = { bookId: string; chapter: number };

type FollowScrollOpts = {
  verseLayoutsRef?: React.RefObject<Map<number, VerseLayout>>;
  scrollViewportHeight?: number;
  scrollOffsetRef?: React.RefObject<number>;
};

export function useReadChapterAudio(
  chapterData: LoadedChapter | null,
  scrollRef: React.RefObject<ScrollView | null>,
  scrollHeaderHeightRef?: React.RefObject<number>,
  onAdvanceChapter?: (target: ChapterTarget) => void,
  followScroll?: FollowScrollOpts,
) {
  const verseLayoutsRef = followScroll?.verseLayoutsRef;
  const scrollViewportHeight = followScroll?.scrollViewportHeight ?? 0;
  const scrollOffsetRef = followScroll?.scrollOffsetRef;
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

  const [chapterAudioSrc, setChapterAudioSrc] = useState<string | null>(null);
  const [verseTimings, setVerseTimings] = useState<CuvChapterVerseTiming[] | null>(null);
  const [weightVerses, setWeightVerses] = useState<readonly { text: string }[] | null>(null);
  const lastFollowScrollAtRef = useRef(0);
  const onAdvanceChapterRef = useRef(onAdvanceChapter);
  onAdvanceChapterRef.current = onAdvanceChapter;
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

  useEffect(() => {
    return () => {
      registerReadChapterRef.current(null);
    };
  }, []);

  useEffect(() => {
    if (!chapterData || !chapterAudioKey) {
      registerReadChapterRef.current(null);
      setChapterAudioSrc(null);
      return;
    }

    const snapshot = chapterData;
    const syncSrc = buildChapterAudioPlayableSrcSync({
      baseUrl: getChapterAudioBaseUrl(),
      translationId: chapterAudioTranslationId,
      bookId: snapshot.bookId,
      chapter: snapshot.chapter,
      bookName: snapshot.bookName,
      voiceId: audioVoiceId,
    });
    const reg = {
      bookId: snapshot.bookId,
      chapter: snapshot.chapter,
      bookName: snapshot.bookName,
      translationId: chapterAudioTranslationId,
      chapterAudioSrc: syncSrc,
      onAdvanceNextChapter: () => {},
      onAdvanceNextInBook: () => {},
    };
    reg.onAdvanceNextChapter = () => {
      const { next } = resolveReadChapterNeighbors(snapshot.bookId, snapshot.chapter);
      if (!next) return;
      onAdvanceChapterRef.current?.(next);
    };
    reg.onAdvanceNextInBook = () => {
      const next = getNextScriptureChapterInBook(snapshot.bookId, snapshot.chapter);
      if (!next) return;
      onAdvanceChapterRef.current?.(next);
    };

    setChapterAudioSrc(reg.chapterAudioSrc);
    registerReadChapterRef.current(reg);

    let cancelled = false;
    const resolveTask = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const resolved = await resolveReadChapterAudioRegistration({
          bookId: snapshot.bookId,
          chapter: snapshot.chapter,
          bookName: snapshot.bookName,
          translationId: chapterAudioTranslationId,
          voiceId: audioVoiceId,
          onAdvanceNextChapter: reg.onAdvanceNextChapter,
          onAdvanceNextInBook: reg.onAdvanceNextInBook,
        });
        if (cancelled) return;
        setChapterAudioSrc(resolved.chapterAudioSrc);
        registerReadChapterRef.current(resolved);
      })();
    });

    return () => {
      cancelled = true;
      resolveTask.cancel();
      // 章节、语音或聚焦状态变化时，先注销旧章节，避免音频继续播上一章却用新章节正文高亮。
      registerReadChapterRef.current(null);
    };
  }, [
    chapterAudioKey,
    audioVoiceId,
    chapterData?.bookId,
    chapterData?.chapter,
    chapterAudioTranslationId,
    chapterData?.bookName,
  ]);

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

  useEffect(() => {
    if (activeVerseIndex === null || !scrollRef.current) return;
    if (!scrollViewportHeight || scrollViewportHeight <= 0) return;

    let cancelled = false;
    let attempts = 0;

    const followActiveVerse = () => {
      if (cancelled || !scrollRef.current) return;

      const verseNum = chapterData?.verses?.[activeVerseIndex]?.verse ?? null;
      const layout = verseNum != null ? verseLayoutsRef?.current?.get(verseNum) : null;
      const scrollOffsetY = scrollOffsetRef?.current ?? 0;
      const now = Date.now();

      if (layout) {
        if (
          isVerseVisibleInScrollViewport(layout, scrollOffsetY, scrollViewportHeight) &&
          now - lastFollowScrollAtRef.current < 900
        ) {
          return;
        }
        lastFollowScrollAtRef.current = now;
        scrollRef.current.scrollTo({
          y: scrollYToCenterVerse(layout, scrollViewportHeight),
          animated: true,
        });
        return;
      }

      attempts += 1;
      if (attempts < 10) {
        requestAnimationFrame(followActiveVerse);
        return;
      }

      if (now - lastFollowScrollAtRef.current < 900) return;
      lastFollowScrollAtRef.current = now;
      const headerY = scrollHeaderHeightRef?.current ?? 0;
      scrollRef.current.scrollTo({
        y: Math.max(0, headerY + activeVerseIndex * 44 - scrollViewportHeight * 0.28),
        animated: true,
      });
    };

    followActiveVerse();
    return () => {
      cancelled = true;
    };
  }, [
    activeVerseIndex,
    chapterData?.verses,
    scrollRef,
    scrollHeaderHeightRef,
    scrollOffsetRef,
    scrollViewportHeight,
    verseLayoutsRef,
  ]);

  useEffect(() => {
    if (activeVerseIndex === null || !audioMatchesChapter || !scrollRef.current) return;
    if (!scrollViewportHeight || scrollViewportHeight <= 0) return;

    const verseNum = chapterData?.verses?.[activeVerseIndex]?.verse ?? null;
    const layout = verseNum != null ? verseLayoutsRef?.current?.get(verseNum) : null;
    if (!layout) return;

    const scrollOffsetY = scrollOffsetRef?.current ?? 0;
    if (isVerseVisibleInScrollViewport(layout, scrollOffsetY, scrollViewportHeight)) return;

    const now = Date.now();
    if (now - lastFollowScrollAtRef.current < 900) return;
    lastFollowScrollAtRef.current = now;
    scrollRef.current.scrollTo({
      y: scrollYToCenterVerse(layout, scrollViewportHeight),
      animated: true,
    });
  }, [
    activeVerseIndex,
    audioMatchesChapter,
    chapterData?.verses,
    scrollRef,
    scrollOffsetRef,
    scrollViewportHeight,
    scripturePlaybackSec,
    verseLayoutsRef,
  ]);

  return {
    supported,
    chapterAudioAvailable: Boolean(chapterAudioSrc),
    activeVerseIndex,
    audioMatchesChapter,
    nearAudioEnd,
  };
}
