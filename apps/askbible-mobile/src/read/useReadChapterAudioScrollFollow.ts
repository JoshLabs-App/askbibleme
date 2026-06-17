import { useEffect, useRef } from "react";
import type { ScrollView } from "react-native";
import type { LoadedChapter } from "../bible/types";
import {
  clampScrollY,
  isVerseVisibleInScrollViewport,
  readVerseScrollFocusRatio,
  scrollYToCenterVerse,
  type VerseLayout,
  type VerseScrollFocusOpts,
} from "./read-chapter-verse-layout";

export type ReadChapterAudioScrollFollowOpts = {
  verseLayoutsRef?: React.RefObject<Map<number, VerseLayout>>;
  scrollViewportHeight?: number;
  scrollOffsetRef?: React.RefObject<number>;
  scrollContentHeightRef?: React.RefObject<number>;
};

type Args = {
  scrollRef: React.RefObject<ScrollView | null>;
  scrollHeaderHeightRef?: React.RefObject<number>;
  followScroll?: ReadChapterAudioScrollFollowOpts;
  isFocused: boolean;
  activeVerseIndex: number | null;
  chapterVerses: LoadedChapter["verses"] | undefined;
  audioMatchesChapter: boolean;
  scripturePlaybackSec: number;
};

export function useReadChapterAudioScrollFollow({
  scrollRef,
  scrollHeaderHeightRef,
  followScroll,
  isFocused,
  activeVerseIndex,
  chapterVerses,
  audioMatchesChapter,
  scripturePlaybackSec,
}: Args) {
  const verseLayoutsRef = followScroll?.verseLayoutsRef;
  const scrollViewportHeight = followScroll?.scrollViewportHeight ?? 0;
  const scrollOffsetRef = followScroll?.scrollOffsetRef;
  const scrollContentHeightRef = followScroll?.scrollContentHeightRef;

  const scrollFocusOpts = (): VerseScrollFocusOpts => ({
    contentHeight: scrollContentHeightRef?.current,
  });

  const lastFollowScrollAtRef = useRef(0);

  useEffect(() => {
    if (!isFocused || activeVerseIndex === null || !scrollRef.current) return;
    if (!scrollViewportHeight || scrollViewportHeight <= 0) return;

    let cancelled = false;
    let attempts = 0;

    const followActiveVerse = () => {
      if (cancelled || !scrollRef.current) return;

      const verseNum = chapterVerses?.[activeVerseIndex]?.verse ?? null;
      const layout = verseNum != null ? verseLayoutsRef?.current?.get(verseNum) : null;
      const scrollOffsetY = scrollOffsetRef?.current ?? 0;
      const now = Date.now();

      if (layout) {
        const focusOpts = scrollFocusOpts();
        if (
          isVerseVisibleInScrollViewport(layout, scrollOffsetY, scrollViewportHeight, focusOpts) &&
          now - lastFollowScrollAtRef.current < 900
        ) {
          return;
        }
        lastFollowScrollAtRef.current = now;
        scrollRef.current.scrollTo({
          y: scrollYToCenterVerse(layout, scrollViewportHeight, focusOpts),
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
      const focusRatio = readVerseScrollFocusRatio();
      const fallbackIdeal = headerY + activeVerseIndex * 44 - scrollViewportHeight * focusRatio;
      scrollRef.current.scrollTo({
        y: clampScrollY(fallbackIdeal, scrollViewportHeight, scrollContentHeightRef?.current),
        animated: true,
      });
    };

    followActiveVerse();
    return () => {
      cancelled = true;
    };
  }, [
    activeVerseIndex,
    chapterVerses,
    isFocused,
    scrollRef,
    scrollHeaderHeightRef,
    scrollOffsetRef,
    scrollViewportHeight,
    verseLayoutsRef,
  ]);

  useEffect(() => {
    if (!isFocused || activeVerseIndex === null || !audioMatchesChapter || !scrollRef.current) return;
    if (!scrollViewportHeight || scrollViewportHeight <= 0) return;

    const verseNum = chapterVerses?.[activeVerseIndex]?.verse ?? null;
    const layout = verseNum != null ? verseLayoutsRef?.current?.get(verseNum) : null;
    if (!layout) return;

    const scrollOffsetY = scrollOffsetRef?.current ?? 0;
    const focusOpts = scrollFocusOpts();
    if (isVerseVisibleInScrollViewport(layout, scrollOffsetY, scrollViewportHeight, focusOpts)) return;

    const now = Date.now();
    if (now - lastFollowScrollAtRef.current < 900) return;
    lastFollowScrollAtRef.current = now;
    scrollRef.current.scrollTo({
      y: scrollYToCenterVerse(layout, scrollViewportHeight, focusOpts),
      animated: true,
    });
  }, [
    activeVerseIndex,
    audioMatchesChapter,
    chapterVerses,
    isFocused,
    scrollContentHeightRef,
    scrollRef,
    scrollOffsetRef,
    scrollViewportHeight,
    scripturePlaybackSec,
    verseLayoutsRef,
  ]);
}
