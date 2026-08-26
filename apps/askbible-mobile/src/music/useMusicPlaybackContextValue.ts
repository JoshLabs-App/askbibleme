import { useMemo, useRef } from "react";
import type { MusicPlaybackContextValue } from "./musicPlaybackContextTypes";
import {
  buildMusicPlaybackContextValue,
  type MusicPlaybackContextValueArgs,
} from "./musicPlaybackContextValueBuild";
import { getMusicPlaybackProgressTickSnapshot } from "./musicPlaybackProgressTick";

export function useMusicPlaybackContextValue(args: MusicPlaybackContextValueArgs): MusicPlaybackContextValue {
  const {
    store,
    tracks,
    trackIndex,
    playing,
    loading,
    playbackMode,
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
    pauseShellPlayback,
    musicCatalogUpdateAvailable,
    checkMusicCatalogUpdate,
    downloadMusicCatalogUpdate,
    downloadingTrackId,
    setReadHomeTodayScriptureReady,
  } = args;

  // 进度秒走 getter + 外部 tick store；勿放进 useMemo deps，否则 Home/底栏每 250ms 整树重渲染。
  // 音乐位置直接读 store：它每 400ms 更新，而 musicCurrentSec state 只在整秒变化时提交，
  // 拿 state 会在两次提交之间读到旧值。
  const progressLive = useRef({ scriptureCurrentSec });
  progressLive.current.scriptureCurrentSec = scriptureCurrentSec;

  return useMemo(() => {
    const value = buildMusicPlaybackContextValue({
      store,
      tracks,
      trackIndex,
      playing,
      loading,
      playbackMode,
      musicCurrentSec: 0,
      musicDurationSec,
      canTogglePlayback,
      scriptureCurrentSec: 0,
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
      pauseShellPlayback,
      musicCatalogUpdateAvailable,
      checkMusicCatalogUpdate,
      downloadMusicCatalogUpdate,
      downloadingTrackId,
      setReadHomeTodayScriptureReady,
    });
    Object.defineProperties(value, {
      musicCurrentSec: {
        configurable: true,
        enumerable: true,
        get: () => getMusicPlaybackProgressTickSnapshot().musicCurrentSec,
      },
      scriptureCurrentSec: {
        configurable: true,
        enumerable: true,
        get: () => progressLive.current.scriptureCurrentSec,
      },
    });
    return value;
  }, [
    store,
    tracks,
    trackIndex,
    playing,
    loading,
    playbackMode,
    musicDurationSec,
    canTogglePlayback,
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
    pauseShellPlayback,
    musicCatalogUpdateAvailable,
    checkMusicCatalogUpdate,
    downloadMusicCatalogUpdate,
    downloadingTrackId,
    setReadHomeTodayScriptureReady,
  ]);
}
