import type { MusicPlaybackContextValue } from "./musicPlaybackContextTypes";

type ShellSlice = {
  registerReadChapter: MusicPlaybackContextValue["registerReadChapter"];
  playTrackAt: MusicPlaybackContextValue["playTrackAt"];
  togglePlayScripture: MusicPlaybackContextValue["togglePlayScripture"];
  stopScripturePlayback: MusicPlaybackContextValue["stopScripturePlayback"];
  playScriptureChapter: MusicPlaybackContextValue["playScriptureChapter"];
  togglePlayMusic: MusicPlaybackContextValue["togglePlayMusic"];
  playNext: MusicPlaybackContextValue["playNext"];
  playPrev: MusicPlaybackContextValue["playPrev"];
  downloadMusicTrackAt: MusicPlaybackContextValue["downloadMusicTrackAt"];
};

export type MusicPlaybackContextValueArgs = {
  store: MusicPlaybackContextValue["store"];
  tracks: MusicPlaybackContextValue["tracks"];
  trackIndex: number;
  playing: boolean;
  loading: boolean;
  playbackMode: MusicPlaybackContextValue["playbackMode"];
  musicCurrentSec: number;
  musicDurationSec: number;
  canTogglePlayback: boolean;
  scriptureCurrentSec: number;
  scriptureDurationSec: number;
  readChapterAudioAvailable: boolean;
  scripturePreparing: boolean;
  scriptureAudioRepeatMode: MusicPlaybackContextValue["scriptureAudioRepeatMode"];
  setScriptureAudioRepeatMode: MusicPlaybackContextValue["setScriptureAudioRepeatMode"];
  scripturePlaybackRate: number;
  setScripturePlaybackRate: MusicPlaybackContextValue["setScripturePlaybackRate"];
  seekRatio: MusicPlaybackContextValue["seekRatio"];
  shell: ShellSlice;
  setMusicGain: MusicPlaybackContextValue["setMusicGain"];
  musicRepeatMode: MusicPlaybackContextValue["musicRepeatMode"];
  setMusicRepeatMode: MusicPlaybackContextValue["setMusicRepeatMode"];
  toggleMusicRepeatOne: MusicPlaybackContextValue["toggleMusicRepeatOne"];
  toggleMusicRepeatAll: MusicPlaybackContextValue["toggleMusicRepeatAll"];
  sleepTimerMinutes: MusicPlaybackContextValue["sleepTimerMinutes"];
  setSleepTimerMinutes: MusicPlaybackContextValue["setSleepTimerMinutes"];
  musicCatalogUpdateAvailable: boolean;
  checkMusicCatalogUpdate: MusicPlaybackContextValue["checkMusicCatalogUpdate"];
  downloadMusicCatalogUpdate: MusicPlaybackContextValue["downloadMusicCatalogUpdate"];
  downloadingTrackId: string | null;
  setReadHomeTodayScriptureReady: MusicPlaybackContextValue["setReadHomeTodayScriptureReady"];
};

export function buildMusicPlaybackContextValue(args: MusicPlaybackContextValueArgs): MusicPlaybackContextValue {
  const { shell, ...rest } = args;
  return {
    ...rest,
    registerReadChapter: shell.registerReadChapter,
    playTrackAt: shell.playTrackAt,
    togglePlayScripture: shell.togglePlayScripture,
    stopScripturePlayback: shell.stopScripturePlayback,
    playScriptureChapter: shell.playScriptureChapter,
    togglePlayMusic: shell.togglePlayMusic,
    playNext: shell.playNext,
    playPrev: shell.playPrev,
    downloadMusicTrackAt: shell.downloadMusicTrackAt,
  };
}
