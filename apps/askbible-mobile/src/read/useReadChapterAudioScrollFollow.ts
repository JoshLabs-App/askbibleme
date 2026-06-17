import { useEffect, useRef } from "react";
import type { ScrollView } from "react-native";
import type { LoadedChapter } from "../bible/types";
import {
  clampScrollY,
  scrollYToCenterVerse,
  type VerseLayout,
  type VerseScrollFocusOpts,
} from "./read-chapter-verse-layout";

/** 音频跟读：高亮经文对齐视口垂直中心 */
const AUDIO_VERSE_SCROLL_FOCUS_OPTS: VerseScrollFocusOpts = {
  topInsetRatio: 0.1,
  bottomInsetRatio: 0.1,
};

export type ReadChapterAudioScrollFollowOpts = {
  verseLayoutsRef?: React.RefObject<Map<number, VerseLayout>>;
  scrollViewportHeight?: number;
  scrollOffsetRef?: React.RefObject<number>;
  scrollContentHeightRef?: React.RefObject<number>;
  remeasureVerseLayoutInContent?: (verseNum: number) => Promise<VerseLayout | null>;
};

type Args = {
  scrollRef: React.RefObject<ScrollView | null>;
  scrollHeaderHeightRef?: React.RefObject<number>;
  followScroll?: ReadChapterAudioScrollFollowOpts;
  isFocused: boolean;
  activeVerseIndex: number | null;
  chapterVerses: LoadedChapter["verses"] | undefined;
  audioMatchesChapter: boolean;
};

export function useReadChapterAudioScrollFollow({
  scrollRef,
  scrollHeaderHeightRef,
  followScroll,
  isFocused,
  activeVerseIndex,
  chapterVerses,
  audioMatchesChapter,
}: Args) {
  const verseLayoutsRef = followScroll?.verseLayoutsRef;
  const scrollViewportHeight = followScroll?.scrollViewportHeight ?? 0;
  const scrollContentHeightRef = followScroll?.scrollContentHeightRef;
  const remeasureVerseLayoutInContent = followScroll?.remeasureVerseLayoutInContent;

  const lastFollowedVerseIndexRef = useRef<number | null>(null);

  const scrollFocusOpts = (): VerseScrollFocusOpts => ({
    ...AUDIO_VERSE_SCROLL_FOCUS_OPTS,
    contentHeight: scrollContentHeightRef?.current,
  });

  useEffect(() => {
    if (!isFocused || !audioMatchesChapter || activeVerseIndex === null || !scrollRef.current) {
      if (!audioMatchesChapter) lastFollowedVerseIndexRef.current = null;
      return;
    }
    if (lastFollowedVerseIndexRef.current === activeVerseIndex) return;
    if (!scrollViewportHeight || scrollViewportHeight <= 0) return;

    let cancelled = false;

    const centerActiveVerse = async () => {
      if (cancelled || !scrollRef.current) return;

      const verseNum = chapterVerses?.[activeVerseIndex]?.verse ?? null;
      let layout =
        verseNum != null && remeasureVerseLayoutInContent
          ? await remeasureVerseLayoutInContent(verseNum)
          : null;
      if (!layout && verseNum != null) {
        layout = verseLayoutsRef?.current?.get(verseNum) ?? null;
      }

      if (cancelled || !scrollRef.current) return;

      if (layout) {
        lastFollowedVerseIndexRef.current = activeVerseIndex;
        scrollRef.current.scrollTo({
          y: scrollYToCenterVerse(layout, scrollViewportHeight, scrollFocusOpts()),
          animated: true,
        });
        return;
      }

      let attempts = 0;
      const retry = () => {
        if (cancelled || !scrollRef.current) return;
        const fallbackVerseNum = chapterVerses?.[activeVerseIndex]?.verse ?? null;
        const retryLayout =
          fallbackVerseNum != null ? verseLayoutsRef?.current?.get(fallbackVerseNum) : null;
        if (retryLayout) {
          lastFollowedVerseIndexRef.current = activeVerseIndex;
          scrollRef.current.scrollTo({
            y: scrollYToCenterVerse(retryLayout, scrollViewportHeight, scrollFocusOpts()),
            animated: true,
          });
          return;
        }
        attempts += 1;
        if (attempts < 12) {
          requestAnimationFrame(retry);
          return;
        }
        lastFollowedVerseIndexRef.current = activeVerseIndex;
        const headerY = scrollHeaderHeightRef?.current ?? 0;
        const focusRatio =
          AUDIO_VERSE_SCROLL_FOCUS_OPTS.topInsetRatio! +
          (1 -
            (AUDIO_VERSE_SCROLL_FOCUS_OPTS.topInsetRatio ?? 0) -
            (AUDIO_VERSE_SCROLL_FOCUS_OPTS.bottomInsetRatio ?? 0)) /
            2;
        const fallbackIdeal = headerY + activeVerseIndex * 44 - scrollViewportHeight * focusRatio;
        scrollRef.current.scrollTo({
          y: clampScrollY(fallbackIdeal, scrollViewportHeight, scrollContentHeightRef?.current),
          animated: true,
        });
      };
      retry();
    };

    void centerActiveVerse();
    return () => {
      cancelled = true;
    };
  }, [
    activeVerseIndex,
    audioMatchesChapter,
    chapterVerses,
    isFocused,
    remeasureVerseLayoutInContent,
    scrollContentHeightRef,
    scrollHeaderHeightRef,
    scrollRef,
    scrollViewportHeight,
    verseLayoutsRef,
  ]);
}
