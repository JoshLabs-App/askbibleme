import { useTogglePlayScriptureWithReadHome } from "./useTogglePlayScriptureWithReadHome";
import { useTodayPlanScriptureResumePersistence } from "../read/useTodayPlanScriptureResumePersistence";
import { useShellMediaControlsSync } from "../audio/useShellMediaControlsSync";
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
    pauseShellPlayback,
  } = shellControls;

  const { checkMusicCatalogUpdate, downloadMusicCatalogUpdate } = catalog;

  console.warn("[music-provider] render", {
    loading,
    mode: playbackMode,
    playing,
    tracks: tracks.length,
    trackIndex,
  });

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

  const startWidgetReadingAudio = useTogglePlayScriptureWithReadHome({
    playing,
    playbackMode,
    togglePlayScriptureBase: shell.togglePlayScripture,
    quickStart: true,
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

  useShellMediaControlsSync({
    loading,
    playing,
    playbackMode,
    tracks,
    trackIndex,
    musicCurrentSec,
    musicDurationSec,
    scriptureCurrentSec,
    scriptureDurationSec,
    readChapter,
    togglePlayMusic: shell.togglePlayMusic,
    pauseShellPlayback,
    playNext: shell.playNext,
    playPrev: shell.playPrev,
    playTrackAt: shell.playTrackAt,
    // 锁屏 / 通知的远程播放键需要「纯暂停/续播」语义，
    // 不能用会在读经页触发「开始今日读经」的 read-home 包装版。
    togglePlayScripture: shell.togglePlayScripture,
    // 桌面「收听」挂件在非读经模式时用包装版开始今日读经。
    startReadingAudio: startWidgetReadingAudio,
  });

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
