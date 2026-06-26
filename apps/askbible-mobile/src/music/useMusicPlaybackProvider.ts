import { useTogglePlayScriptureWithReadHome } from "./useTogglePlayScriptureWithReadHome";
import { useTodayPlanScriptureResumePersistence } from "../read/useTodayPlanScriptureResumePersistence";
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
    readHomeTodayAudioReady,
    setReadHomeTodayAudioReady,
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
    playing,
    scripturePreparing,
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

  const togglePlayScripture = useTogglePlayScriptureWithReadHome({
    playing,
    playbackMode,
    togglePlayScriptureBase: shell.togglePlayScripture,
  });

  useTodayPlanScriptureResumePersistence({
    playing,
    playbackMode,
    scriptureDurationSec,
  });

  const readChapterAudioAvailable = resolveReadChapterAudioAvailable(
    shell.readChapterRef,
    readChapter,
    readHomeTodayAudioReady,
  );
  const canTogglePlayback = resolveCanTogglePlayback(tracks, readChapterAudioAvailable);

  syncMusicPlaybackControlSnapshot(playing, playbackMode, togglePlayScripture);

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
    shell: { ...shell, togglePlayScripture },
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
    setReadHomeTodayScriptureReady: setReadHomeTodayAudioReady,
  });
}
