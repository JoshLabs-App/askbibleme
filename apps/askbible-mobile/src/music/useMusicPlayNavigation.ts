import { useCallback, type MutableRefObject } from "react";
import { pickRandomNextTrackIndex } from "./musicCalmPlayback";
import type { MusicPlaybackMode } from "./musicPlaybackTypes";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";

type Args = {
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  trackIndex: number;
  tracksLength: number;
  playTrackAt: (index: number) => Promise<void>;
  resolveActiveReadChapter: () => ReadChapterPlaybackRegistration | null | undefined;
};

export function useMusicPlayNavigation({
  playbackModeRef,
  trackIndex,
  tracksLength,
  playTrackAt,
  resolveActiveReadChapter,
}: Args) {
  const playNext = useCallback(async () => {
    if (playbackModeRef.current === "scripture") {
      resolveActiveReadChapter()?.onAdvanceNextChapter();
      return;
    }
    await playTrackAt(pickRandomNextTrackIndex(trackIndex, tracksLength));
  }, [playbackModeRef, playTrackAt, resolveActiveReadChapter, trackIndex, tracksLength]);

  const playPrev = useCallback(async () => {
    await playTrackAt(trackIndex - 1);
  }, [playTrackAt, trackIndex]);

  return { playNext, playPrev };
}
