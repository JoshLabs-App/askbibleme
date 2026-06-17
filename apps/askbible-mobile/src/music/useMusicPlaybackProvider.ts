import {
  resolveCanTogglePlayback,
  resolveReadChapterAudioAvailable,
} from "./musicPlaybackAvailability";
import { syncMusicPlaybackControlSnapshot } from "./musicPlaybackControlSnapshot";
import { useMusicPlaybackContextValue } from "./useMusicPlaybackContextValue";
import { useMusicPlaybackProviderSetup } from "./useMusicPlaybackProviderSetup";
import { useMusicPlaybackShellWiring } from "./useMusicPlaybackShellWiring";
import type { MusicPlaybackContextValue } from "./musicPlaybackContextTypes";

export function useMusicPlaybackProvider(): MusicPlaybackContextValue {
  const setup = useMusicPlaybackProviderSetup();
  const {
    refs,
    state,
    tracks,
    setMusicPackRevision,
    syncPlayingState,
    endMusicSession,
    persistMusicResume,
    scripturePrefs,
    shellControls,
    catalog,
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
  } = setup;

  const {
    store,
    trackIndex,
    playing,
    loading,
    playbackMode,
    scriptureCurrentSec,
    scriptureDurationSec,
    scripturePreparing,
    musicCurrentSec,
    musicDurationSec,
    musicRepeatMode,
    sleepTimerMinutes,
    musicCatalogUpdateAvailable,
    downloadingTrackId,
  } = state;

  const {
    scriptureAudioRepeatMode,
    scripturePlaybackRate,
    scriptureAudioRepeatRef,
    scripturePlaybackRateRef,
    setScriptureAudioRepeatMode,
    setScripturePlaybackRate,
  } = scripturePrefs;

  const {
    setMusicRepeatMode,
    toggleMusicRepeatOne,
    toggleMusicRepeatAll,
    setSleepTimerMinutes,
    seekRatio,
    setMusicGain,
  } = shellControls;

  const { checkMusicCatalogUpdate, downloadMusicCatalogUpdate } = catalog;

  const shell = useMusicPlaybackShellWiring({
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
  });

  const readChapterAudioAvailable = resolveReadChapterAudioAvailable(shell.readChapterRef, readChapter);
  const canTogglePlayback = resolveCanTogglePlayback(tracks, readChapterAudioAvailable);

  syncMusicPlaybackControlSnapshot(playing, playbackMode, shell.togglePlayScripture);

  return useMusicPlaybackContextValue({
    store,
    tracks,
    trackIndex,
    playing,
    loading,
    playbackMode,
    musicCurrentSec,
    musicDurationSec,
    canTogglePlayback,
    scriptureCurrentSec,
    scriptureDurationSec,
    readChapterAudioAvailable,
    scripturePreparing,
    scriptureAudioRepeatMode,
    setScriptureAudioRepeatMode,
    scripturePlaybackRate,
    setScripturePlaybackRate,
    seekRatio,
    shell,
    setMusicGain,
    musicRepeatMode,
    setMusicRepeatMode,
    toggleMusicRepeatOne,
    toggleMusicRepeatAll,
    sleepTimerMinutes,
    setSleepTimerMinutes,
    musicCatalogUpdateAvailable,
    checkMusicCatalogUpdate,
    downloadMusicCatalogUpdate,
    downloadingTrackId,
  });
}
