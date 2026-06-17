import { useMemo } from "react";
import { createMusicPlayTrackBridge, createScriptureShellBridge } from "./musicPlaybackBridges";
import { useMusicPlayNavigation } from "./useMusicPlayNavigation";
import { useMusicPlayTrack } from "./useMusicPlayTrack";
import { useMusicShellUnload } from "./useMusicShellUnload";
import { useMusicTrackDownload } from "./useMusicTrackDownload";
import { useScriptureShellPlayback } from "./scriptureShellPlayback";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";
import type { ReadChapterPlaybackRegistration, ScriptureAudioRepeatMode } from "./scripturePlaybackTypes";
import type { PlaybackTrack } from "./types";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";

type Args = {
  refs: MusicPlaybackRefs;
  tracks: PlaybackTrack[];
  trackIndex: number;
  readChapter: ReadChapterPlaybackRegistration | null;
  setReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
  setScripturePreparing: (preparing: boolean) => void;
  setScriptureCurrentSec: (sec: number) => void;
  setScriptureDurationSec: (sec: number) => void;
  setTrackIndex: (index: number) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  setDownloadingTrackId: Dispatch<SetStateAction<string | null>>;
  setMusicPackRevision: (fn: (n: number) => number) => void;
  scripturePlaybackRateRef: MutableRefObject<number>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  syncPlayingState: (playing: boolean) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  endMusicSession: () => void;
};

export function useMusicPlaybackShellWiring(args: Args) {
  const {
    refs,
    tracks,
    trackIndex,
    readChapter,
    setReadChapter,
    setPlaying,
    setPlaybackMode,
    setScripturePreparing,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    setTrackIndex,
    setMusicCurrentSec,
    setMusicDurationSec,
    setDownloadingTrackId,
    setMusicPackRevision,
    scripturePlaybackRateRef,
    scriptureAudioRepeatRef,
    syncPlayingState,
    persistMusicResume,
    endMusicSession,
  } = args;

  const unloadCurrent = useMusicShellUnload(refs);

  const scriptureBridge = useMemo(
    () => createScriptureShellBridge(refs, unloadCurrent, endMusicSession),
    [endMusicSession, refs, unloadCurrent],
  );

  const scripture = useScriptureShellPlayback({
    bridge: scriptureBridge,
    readChapter,
    setReadChapter,
    setPlaying,
    setPlaybackMode,
    setScripturePreparing,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    scripturePlaybackRateRef,
    scriptureAudioRepeatRef,
    lastScriptureProgressSecRef: refs.lastScriptureProgressSecRef,
  });

  const { cacheMusicTrackInBackground, downloadMusicTrackAt } = useMusicTrackDownload({
    tracks,
    storeRef: refs.storeRef,
    setDownloadingTrackId,
    setMusicPackRevision,
  });

  const musicPlayTrackBridge = useMemo(
    () => createMusicPlayTrackBridge(refs, scripture.scriptureSrcRef),
    [refs, scripture.scriptureSrcRef],
  );

  const { playTrackAt, togglePlayMusic } = useMusicPlayTrack({
    bridge: musicPlayTrackBridge,
    tracks,
    trackIndex,
    unloadCurrent,
    endMusicSession,
    persistMusicResume,
    syncPlayingState,
    setPlaying,
    setTrackIndex,
    setPlaybackMode,
    setMusicCurrentSec,
    setMusicDurationSec,
    cacheMusicTrackInBackground,
    downloadMusicTrackAt,
    musicRepeatModeRef: refs.musicRepeatModeRef,
  });

  refs.playTrackAtRef.current = playTrackAt;

  const { playNext, playPrev } = useMusicPlayNavigation({
    playbackModeRef: refs.playbackModeRef,
    trackIndex,
    tracks,
    tracksLength: tracks.length,
    musicRepeatModeRef: refs.musicRepeatModeRef,
    playTrackAt,
    resolveActiveReadChapter: scripture.resolveActiveReadChapter,
  });

  return useMemo(
    () => ({
      ...scripture,
      playTrackAt,
      togglePlayMusic,
      playNext,
      playPrev,
      downloadMusicTrackAt,
    }),
    [scripture, playTrackAt, togglePlayMusic, playNext, playPrev, downloadMusicTrackAt],
  );
}
