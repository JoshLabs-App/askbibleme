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
  audioDockVisible?: boolean;
};

type Args = {
  scrollRef: React.RefObject<ScrollView | null>;
  followScroll?: ReadChapterAudioScrollFollowOpts;
  isFocused: boolean;
  activeVerseIndex: number | null;
  chapterVerses: LoadedChapter["verses"] | undefined;
  audioFollowActive: boolean;
  chapterKey?: string | null;
  scripturePlaybackSec?: number;
};

export function useReadChapterAudioScrollFollow({
  scrollRef,
  followScroll,
  isFocused,
  activeVerseIndex,
  chapterVerses,
  audioFollowActive,
  chapterKey = null,
  scripturePlaybackSec = 0,
}: Args) {
  const scrollVerseToReadableCenter = followScroll?.scrollVerseToReadableCenter;
  const audioDockVisible = followScroll?.audioDockVisible ?? false;
  const lastFollowedVerseIndexRef = useRef<number | null>(null);
  const pendingVerseIndexRef = useRef<number | null>(null);

  useEffect(() => {
    lastFollowedVerseIndexRef.current = null;
    pendingVerseIndexRef.current = null;
  }, [chapterKey]);

  useEffect(() => {
    if (
      !isFocused ||
      !audioFollowActive ||
      activeVerseIndex === null ||
      !scrollRef.current ||
      !scrollVerseToReadableCenter
    ) {
      if (!audioFollowActive) {
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

    const runScroll = async (attempt = 0) => {
      if (cancelled || !scrollRef.current || pendingVerseIndexRef.current !== activeVerseIndex) {
        return;
      }
      const ok = await scrollVerseToReadableCenter(verseNum, audioDockVisible, true);
      if (cancelled || pendingVerseIndexRef.current !== activeVerseIndex) return;
      if (ok) {
        lastFollowedVerseIndexRef.current = activeVerseIndex;
        return;
      }
      if (attempt < 2) {
        setTimeout(() => {
          void runScroll(attempt + 1);
        }, 280);
      }
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
    audioDockVisible,
    audioFollowActive,
    chapterVerses,
    isFocused,
    scrollRef,
    scrollVerseToReadableCenter,
    scripturePlaybackSec,
  ]);
}
