import { useCallback, type MutableRefObject } from "react";
import { pickRandomNextTrackIndex, pickRandomNextTrackIndexInAlbum } from "./musicCalmPlayback";
import type { MusicPlaybackMode, MusicRepeatMode } from "./musicPlaybackTypes";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { PlaybackTrack } from "./types";

type Args = {
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  trackIndex: number;
  tracks: PlaybackTrack[];
  tracksLength: number;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  playTrackAt: (index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>;
  resolveActiveReadChapter: () => ReadChapterPlaybackRegistration | null | undefined;
};

export function useMusicPlayNavigation({
  playbackModeRef,
  trackIndex,
  tracks,
  tracksLength,
  musicRepeatModeRef,
  playTrackAt,
  resolveActiveReadChapter,
}: Args) {
  const playNext = useCallback(async () => {
    if (playbackModeRef.current === "scripture") {
      resolveActiveReadChapter()?.onAdvanceNextChapter();
      return;
    }
    if (musicRepeatModeRef.current === "all") {
      await playTrackAt(pickRandomNextTrackIndexInAlbum(tracks, trackIndex, tracksLength));
      return;
    }
    await playTrackAt(pickRandomNextTrackIndex(trackIndex, tracksLength));
  }, [
    musicRepeatModeRef,
    playbackModeRef,
    playTrackAt,
    resolveActiveReadChapter,
    trackIndex,
    tracks,
    tracksLength,
  ]);

  const playPrev = useCallback(async () => {
    if (playbackModeRef.current === "scripture") {
      resolveActiveReadChapter()?.onAdvancePreviousChapter();
      return;
    }
    await playTrackAt(trackIndex - 1);
  }, [playTrackAt, playbackModeRef, resolveActiveReadChapter, trackIndex]);

  return { playNext, playPrev };
}
