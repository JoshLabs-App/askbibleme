import { useCallback, useEffect } from "react";
import { InteractionManager } from "react-native";
import type { LoadedChapter } from "../bible/types";
import {
  isReadChapterCompleted,
} from "./read-chapter-completion";
import { recordTodayReadingChapterFraction } from "./reading-plan/today-reading-chapter-fraction";
import { markTodayReadingAudioChapterComplete } from "./reading-plan/today-reading-done";

type Args = {
  chapterData: LoadedChapter | null;
  chapterCompleted: boolean;
  setChapterCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  chapterCompletionMarkedRef: React.MutableRefObject<boolean>;
  chapterScrollIntentRef: React.MutableRefObject<boolean>;
  setContrastLoadRequested: React.Dispatch<React.SetStateAction<boolean>>;
  setHighlightsLoadRequested: React.Dispatch<React.SetStateAction<boolean>>;
  setPostReadingReady: React.Dispatch<React.SetStateAction<boolean>>;
  onChapterScrollOffset: (y: number) => void;
  scrollContentHeightRef: React.MutableRefObject<number>;
  audioViewportHeight: number;
  scrollViewportHeight: number;
  activeVerseIndex: number | null;
  nearAudioEnd: boolean;
  lastRecordedFractionRef: React.MutableRefObject<{
    bookId: string;
    chapter: number;
    fraction: number;
  } | null>;
};

export function useReadChapterScreenProgress({
  chapterData,
  chapterCompleted,
  setChapterCompleted,
  chapterCompletionMarkedRef,
  chapterScrollIntentRef,
  setContrastLoadRequested,
  setHighlightsLoadRequested,
  setPostReadingReady,
  onChapterScrollOffset,
  scrollContentHeightRef,
  audioViewportHeight,
  scrollViewportHeight,
  activeVerseIndex,
  nearAudioEnd,
  lastRecordedFractionRef,
}: Args) {

  const markChapterDone = useCallback(() => {
    if (!chapterData) return;
    if (chapterCompletionMarkedRef.current) return;
    chapterCompletionMarkedRef.current = true;
    setChapterCompleted(true);
    void markTodayReadingAudioChapterComplete(chapterData.bookId, chapterData.chapter);
  }, [chapterData]);

  useEffect(() => {
    if (!chapterData) return;
    chapterCompletionMarkedRef.current = false;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void isReadChapterCompleted(chapterData.bookId, chapterData.chapter).then((done) => {
        if (cancelled) return;
        setChapterCompleted(done);
        if (done) chapterCompletionMarkedRef.current = true;
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [chapterData?.bookId, chapterData?.chapter]);

  useEffect(() => {
    if (!nearAudioEnd) return;
    markChapterDone();
  }, [markChapterDone, nearAudioEnd]);

  useEffect(() => {
    if (!chapterData || !chapterCompleted) return;
    void markTodayReadingAudioChapterComplete(chapterData.bookId, chapterData.chapter);
  }, [chapterData?.bookId, chapterData?.chapter, chapterCompleted]);

  const onChapterScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { y } = event.nativeEvent.contentOffset;
      onChapterScrollOffset(y);
      const { height: contentH } = event.nativeEvent.contentSize;
      if (contentH > 0) scrollContentHeightRef.current = contentH;
      const { height: viewportH } = event.nativeEvent.layoutMeasurement;
      if (!chapterData || contentH <= 0 || viewportH <= 0) return;
      const scrollProgress = Math.min(1, (y + viewportH) / contentH);
      if (y > 12 || scrollProgress > 0.04) {
        chapterScrollIntentRef.current = true;
        setContrastLoadRequested((prev) => prev || true);
        setHighlightsLoadRequested((prev) => prev || true);
      }
      void recordTodayReadingChapterFraction(
        chapterData.bookId,
        chapterData.chapter,
        scrollProgress,
      );
      if (scrollProgress > 0.58 || y + viewportH >= contentH - 160) {
        setPostReadingReady(true);
      }
      if (scrollProgress >= 0.88 || y + viewportH >= contentH - 48) {
        markChapterDone();
      }
    },
    [chapterData, markChapterDone, onChapterScrollOffset],
  );

  const onChapterContentSizeChange = useCallback(
    (_w: number, contentH: number) => {
      if (!chapterData || contentH <= 0) return;
      scrollContentHeightRef.current = contentH;
      const viewportH = audioViewportHeight || scrollViewportHeight;
      if (viewportH <= 0) return;
      if (contentH <= viewportH + 40) {
        chapterScrollIntentRef.current = true;
        void recordTodayReadingChapterFraction(chapterData.bookId, chapterData.chapter, 1);
        markChapterDone();
      }
    },
    [audioViewportHeight, chapterData, markChapterDone, scrollViewportHeight],
  );

  useEffect(() => {
    if (!chapterData?.verses.length) return;
    const total = chapterData.verses.length;
    const verseIdx =
      activeVerseIndex != null && activeVerseIndex >= 0 && activeVerseIndex < total
        ? activeVerseIndex
        : -1;
    const fraction = verseIdx >= 0 ? Math.min(1, (verseIdx + 1) / total) : 0;
    const prev = lastRecordedFractionRef.current;
    if (
      prev?.bookId === chapterData.bookId &&
      prev?.chapter === chapterData.chapter &&
      Math.abs(prev.fraction - fraction) < 0.04
    ) {
      return;
    }
    const timer = setTimeout(() => {
      lastRecordedFractionRef.current = {
        bookId: chapterData.bookId,
        chapter: chapterData.chapter,
        fraction,
      };
      void recordTodayReadingChapterFraction(chapterData.bookId, chapterData.chapter, fraction);
    }, 700);
    return () => clearTimeout(timer);
  }, [chapterData, activeVerseIndex]);

  return {
    onChapterScroll,
    onChapterContentSizeChange,
    markChapterDone,
  };
}
