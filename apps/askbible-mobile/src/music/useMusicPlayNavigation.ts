import { useCallback, type MutableRefObject } from "react";
import { pickRandomNextTrackIndexInAlbum } from "./musicCalmPlayback";
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
  musicRepeatModeRef: _musicRepeatModeRef,
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
    // 始终留在当前专辑内换曲；跨专辑只允许用户在音乐栏主动切换。
    await playTrackAt(pickRandomNextTrackIndexInAlbum(tracks, index, tracksLength));
  }, [
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
