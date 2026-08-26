import { useCallback, useState } from "react";
import type { ReadChapterPlaybackRegistration } from "./scripturePlaybackTypes";
import type { MusicPlaybackMode, MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import type { MusicCompanionStore } from "./types";
import { getBundledMusicCompanionStore } from "./musicCompanionBundled";
import {
  getMusicPlaybackProgressTickSnapshot,
  publishMusicPlaybackProgressTick,
} from "./musicPlaybackProgressTick";

export function useMusicPlaybackProviderState() {
  const [store, setStore] = useState<MusicCompanionStore | null>(() => getBundledMusicCompanionStore());
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playbackMode, setPlaybackMode] = useState<MusicPlaybackMode>("music");
  const [readChapter, setReadChapter] = useState<ReadChapterPlaybackRegistration | null>(null);
  const [scriptureCurrentSec, setScriptureCurrentSecState] = useState(0);
  const [scriptureDurationSec, setScriptureDurationSec] = useState(0);
  const [scripturePreparing, setScripturePreparing] = useState(false);
  const [musicCurrentSec, setMusicCurrentSecState] = useState(0);
  const [musicDurationSec, setMusicDurationSec] = useState(0);
  const [musicRepeatMode, setMusicRepeatModeState] = useState<MusicRepeatMode>("all");
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<0 | ShellSleepTimerMinutes>(0);
  const [musicCatalogUpdateAvailable, setMusicCatalogUpdateAvailable] = useState(false);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [readHomeTodayAudioReady, setReadHomeTodayAudioReady] = useState(false);

  /**
   * 播放位置永远先进外部 tick store（进度条 / 时钟读它），React state 只在整秒变化时提交。
   *
   * 原生播放器每 400ms 报一次进度；每次都提交 state 会让整个 provider 的 hook 栈
   * 以 2.5Hz 重跑。UI 不需要这个重渲染——它读 store。
   * 跳转 / 换曲 / 归零幅度大或往回走，仍然立刻提交，不能被节流吞掉。
   */
  const setMusicCurrentSec = useCallback((sec: number) => {
    publishMusicPlaybackProgressTick(
      sec,
      getMusicPlaybackProgressTickSnapshot().scriptureCurrentSec,
    );
    setMusicCurrentSecState((prev) => {
      const smallForwardStep = sec >= prev && sec - prev < 1;
      if (smallForwardStep && Math.floor(sec) === Math.floor(prev)) return prev;
      return sec;
    });
  }, []);

  /** 读经位置同音乐：细进度走 scripturePlaybackSec store；React state 整秒才提交。 */
  const setScriptureCurrentSec = useCallback((sec: number) => {
    publishMusicPlaybackProgressTick(
      getMusicPlaybackProgressTickSnapshot().musicCurrentSec,
      sec,
    );
    setScriptureCurrentSecState((prev) => {
      const smallForwardStep = sec >= prev && sec - prev < 1;
      if (smallForwardStep && Math.floor(sec) === Math.floor(prev)) return prev;
      return sec;
    });
  }, []);

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
