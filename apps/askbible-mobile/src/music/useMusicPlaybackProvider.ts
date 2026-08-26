import { useCallback } from "react";
import { useRouter } from "expo-router";
import { NativeModules, Platform } from "react-native";
import { getShellAuxMediaOwner } from "../audio/shellAuxMediaOwner";
import { resumeShellAppMusic } from "../audio/shellMediaControls";
import { getShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { useTogglePlayScriptureWithReadHome } from "./useTogglePlayScriptureWithReadHome";
import { useTodayPlanScriptureResumePersistence } from "../read/useTodayPlanScriptureResumePersistence";
import { startTodayReadingScriptureFromReadHome } from "../read/startTodayReadingScriptureFromReadHome";
import { useShellMediaControlsSync } from "../audio/useShellMediaControlsSync";
import {
  resolveCanTogglePlayback,
  resolveReadChapterAudioAvailable,
} from "./musicPlaybackAvailability";
import { syncMusicPlaybackControlSnapshot } from "./musicPlaybackControlSnapshot";
import {
  getMusicPlaybackProgressTickSnapshot,
  publishMusicPlaybackProgressTick,
} from "./musicPlaybackProgressTick";
import { useMusicPlaybackContextValue } from "./useMusicPlaybackContextValue";
import { useMusicPlaybackProviderSetup } from "./useMusicPlaybackProviderSetup";
import { useMusicPlaybackShellWiring } from "./useMusicPlaybackShellWiring";
import { useScriptureHighlightForegroundSync } from "./useScriptureHighlightForegroundSync";
import { recoverMusicPlaybackAfterBackground } from "./musicResumeAfterInterruption";
import { isScriptureUserPauseHeld } from "./scriptureUserPause";
import type { MusicPlaybackContextValue } from "./musicPlaybackContextTypes";
import { queueWidgetVersePlay, requestWidgetVerseStop } from "../widget/widgetPlaybackRequest";

export function useMusicPlaybackProvider(): MusicPlaybackContextValue {
  useScriptureHighlightForegroundSync();
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

  const router = useRouter();

  const togglePlayScripture = useTogglePlayScriptureWithReadHome({
    playing,
    playbackMode,
    togglePlayScriptureBase: shell.togglePlayScripture,
    playScriptureChapter: shell.playScriptureChapter,
  });

  /** 桌面挂件「读经」：直接开播今日计划（listen），不先跳计划页。 */
  const startWidgetReadingAudio = useCallback(async () => {
    // 与金句互斥：开读经前先停金句。
    requestWidgetVerseStop();
    if (playbackMode === "scripture" && playing) {
      await shell.togglePlayScripture({ forcePause: true });
      return true;
    }
    if (playbackMode === "scripture" && !playing) {
      await shell.togglePlayScripture();
      return true;
    }
    return startTodayReadingScriptureFromReadHome(router, {
      quickStart: true,
      uiHost: "listen",
      loopTodayPlan: true,
    });
  }, [playbackMode, playing, router, shell]);

  const startWidgetVerseAudio = useCallback(async (verseKey?: string) => {
    // 与读经互斥：开金句前先停读经计划。
    await shell.togglePlayScripture({ forcePause: true });
    // 优先用事件载荷；否则再 sync peek（native emit 成功后会 clear pending）。
    let key = (verseKey || "").trim().toUpperCase() || null;
    if (!key && Platform.OS === "android") {
      try {
        const mod = NativeModules.AskBibleWidgetPrefs as
          | { peekWidgetPlaybackVerseKeySync?: () => string | null }
          | undefined;
        key = mod?.peekWidgetPlaybackVerseKeySync?.()?.trim().toUpperCase() || null;
      } catch {
        key = null;
      }
    }
    if (key) queueWidgetVersePlay(key);
    router.push("/");
    return !!key;
  }, [router, shell]);

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

  const ensureShellPlaybackActive = useCallback(async () => {
    if (refs.playbackModeRef.current === "music" || getShellMusicWantPlaying()) {
      const recovered = await recoverMusicPlaybackAfterBackground({
        playbackModeRef: refs.playbackModeRef,
        soundRef: refs.soundRef,
        playingStateRef: refs.playingStateRef,
        musicGainRef: refs.musicGainRef,
        setPlaying,
      });
      // JS 已标 playing 时也要 resume：三星 OEM Pause 会只停原生、不改 UI。
      resumeShellAppMusic();
      if (!recovered && !playing) {
        await shell.togglePlayMusic();
      }
      return;
    }
    if (refs.playbackModeRef.current === "scripture") {
      if (isScriptureUserPauseHeld()) return;
      if (getShellScriptureWantPlaying() || playing) {
        resumeShellAppMusic();
      }
      if (!playing) await shell.togglePlayScripture();
      return;
    }
    const aux = getShellAuxMediaOwner();
    if (aux) await aux.resume();
  }, [playing, refs, setPlaying, shell]);

  syncMusicPlaybackControlSnapshot(playing, playbackMode, togglePlayScripture);
  // 音乐位置由 setMusicCurrentSec 直接写 store（比这里的 state 更新），这里只负责推进读经秒数。
  publishMusicPlaybackProgressTick(
    getMusicPlaybackProgressTickSnapshot().musicCurrentSec,
    scriptureCurrentSec,
  );

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
    ensureShellPlaybackActive,
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
    startVerseAudio: startWidgetVerseAudio,
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
    pauseShellPlayback,
    musicCatalogUpdateAvailable,
    checkMusicCatalogUpdate,
    downloadMusicCatalogUpdate,
    downloadingTrackId,
    setReadHomeTodayScriptureReady: setReadHomeTodayAudioReady,
  });
}
