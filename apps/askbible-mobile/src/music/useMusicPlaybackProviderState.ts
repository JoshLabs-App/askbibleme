import { useState } from "react";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { MusicPlaybackMode, MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import type { MusicCompanionStore } from "./types";

export function useMusicPlaybackProviderState() {
  const [store, setStore] = useState<MusicCompanionStore | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playbackMode, setPlaybackMode] = useState<MusicPlaybackMode>("music");
  const [readChapter, setReadChapter] = useState<ReadChapterPlaybackRegistration | null>(null);
  const [scriptureCurrentSec, setScriptureCurrentSec] = useState(0);
  const [scriptureDurationSec, setScriptureDurationSec] = useState(0);
  const [scripturePreparing, setScripturePreparing] = useState(false);
  const [musicCurrentSec, setMusicCurrentSec] = useState(0);
  const [musicDurationSec, setMusicDurationSec] = useState(0);
  const [musicRepeatMode, setMusicRepeatModeState] = useState<MusicRepeatMode>("all");
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<0 | ShellSleepTimerMinutes>(0);
  const [musicCatalogUpdateAvailable, setMusicCatalogUpdateAvailable] = useState(false);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [readHomeTodayAudioReady, setReadHomeTodayAudioReady] = useState(false);

  return {
    store,
    setStore,
    trackIndex,
    setTrackIndex,
    playing,
    setPlaying,
    loading,
    setLoading,
    playbackMode,
    setPlaybackMode,
    readChapter,
    setReadChapter,
    scriptureCurrentSec,
    setScriptureCurrentSec,
    scriptureDurationSec,
    setScriptureDurationSec,
    scripturePreparing,
    setScripturePreparing,
    musicCurrentSec,
    setMusicCurrentSec,
    musicDurationSec,
    setMusicDurationSec,
    musicRepeatMode,
    setMusicRepeatModeState,
    sleepTimerMinutes,
    setSleepTimerMinutesState,
    musicCatalogUpdateAvailable,
    setMusicCatalogUpdateAvailable,
    downloadingTrackId,
    setDownloadingTrackId,
    readHomeTodayAudioReady,
    setReadHomeTodayAudioReady,
  };
}

export type MusicPlaybackProviderState = ReturnType<typeof useMusicPlaybackProviderState>;
