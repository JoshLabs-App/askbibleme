import { useEffect, useRef } from "react";
import { InteractionManager } from "react-native";
import type { ScrollView } from "react-native";
import type { LoadedChapter } from "../bible/types";

export type ReadChapterAudioScrollFollowOpts = {
  scrollVerseToReadableCenter?: (
    verseNum: number,
    audioDockVisible: boolean,
    animated?: boolean,
  ) => Promise<boolean>;
};

type Args = {
  scrollRef: React.RefObject<ScrollView | null>;
  followScroll?: ReadChapterAudioScrollFollowOpts;
  isFocused: boolean;
  activeVerseIndex: number | null;
  chapterVerses: LoadedChapter["verses"] | undefined;
  audioMatchesChapter: boolean;
};

export function useReadChapterAudioScrollFollow({
  scrollRef,
  followScroll,
  isFocused,
  activeVerseIndex,
  chapterVerses,
  audioMatchesChapter,
}: Args) {
  const scrollVerseToReadableCenter = followScroll?.scrollVerseToReadableCenter;
  const lastFollowedVerseIndexRef = useRef<number | null>(null);
  const pendingVerseIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      !isFocused ||
      !audioMatchesChapter ||
      activeVerseIndex === null ||
      !scrollRef.current ||
      !scrollVerseToReadableCenter
    ) {
      if (!audioMatchesChapter) {
        lastFollowedVerseIndexRef.current = null;
        pendingVerseIndexRef.current = null;
      }
      return;
    }
    if (lastFollowedVerseIndexRef.current === activeVerseIndex) return;

    let cancelled = false;
    const verseNum = chapterVerses?.[activeVerseIndex]?.verse ?? null;
    if (verseNum == null) return;
    pendingVerseIndexRef.current = activeVerseIndex;

    const runScroll = async () => {
      if (cancelled || !scrollRef.current || pendingVerseIndexRef.current !== activeVerseIndex) {
        return;
      }
      const ok = await scrollVerseToReadableCenter(verseNum, audioMatchesChapter, true);
      if (cancelled || pendingVerseIndexRef.current !== activeVerseIndex) return;
      if (ok) lastFollowedVerseIndexRef.current = activeVerseIndex;
    };

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        void runScroll();
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    activeVerseIndex,
    audioMatchesChapter,
    chapterVerses,
    isFocused,
    scrollRef,
    scrollVerseToReadableCenter,
  ]);
}
