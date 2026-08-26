import { useCallback, type MutableRefObject } from "react";
import { pickRandomNextTrackIndex, pickRandomNextTrackIndexInAlbum } from "./musicCalmPlayback";
import type { MusicPlaybackMode, MusicRepeatMode } from "./musicPlaybackTypes";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { PlaybackTrack } from "./types";
import { scriptureCommandSkipNext, scriptureCommandSkipPrev } from "./scriptureCommands";

type Args = {
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  trackIndexRef: MutableRefObject<number>;
  tracks: PlaybackTrack[];
  tracksLength: number;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  playTrackAt: (index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>;
  resolveActiveReadChapter: () => ReadChapterPlaybackRegistration | null | undefined;
};

export function useMusicPlayNavigation({
  playbackModeRef,
  trackIndexRef,
  tracks,
  tracksLength,
  musicRepeatModeRef,
  playTrackAt,
  resolveActiveReadChapter,
}: Args) {
  const playNext = useCallback(async () => {
    if (playbackModeRef.current === "scripture") {
      // 运输层命令：池优先，否则 playing 注册回调（非 browse）。
      const ok = await scriptureCommandSkipNext();
      if (!ok) resolveActiveReadChapter()?.onAdvanceNextChapter();
      return;
    }
    const index = trackIndexRef.current;
    if (musicRepeatModeRef.current === "all") {
      await playTrackAt(pickRandomNextTrackIndexInAlbum(tracks, index, tracksLength));
      return;
    }
    await playTrackAt(pickRandomNextTrackIndex(index, tracksLength));
  }, [
    musicRepeatModeRef,
    playbackModeRef,
    playTrackAt,
    resolveActiveReadChapter,
    trackIndexRef,
    tracks,
    tracksLength,
  ]);

  const playPrev = useCallback(async () => {
    if (playbackModeRef.current === "scripture") {
      const ok = await scriptureCommandSkipPrev();
      if (!ok) resolveActiveReadChapter()?.onAdvancePreviousChapter();
      return;
    }
    await playTrackAt(trackIndexRef.current - 1);
  }, [playTrackAt, playbackModeRef, resolveActiveReadChapter, trackIndexRef]);

  return { playNext, playPrev };
}
