import { useCallback, useMemo, useState } from "react";
import { usePlaybackSnapshot } from "../audio/playbackState";
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
  /**
   * `playing` / `playbackMode` **由原生快照派生**，不再是 JS 自己的 state。
   *
   * 这两个值曾是三路音频共用的 React state，谁都能写、谁都在读，于是同一个按钮的图标和
   * 点击处理会得出不同答案（2026-09-08 实测「播着音乐点读经没反应」）。真相在原生：
   * 它知道此刻哪几条流真的在出声。
   *
   * 下面的 setter 保留，是为了不一次性改动四十多个写入方；它们只更新本地 state，
   * **不再决定任何读值**。改到某个写入方时应直接删掉它，而不是继续调用。
   */
  const [, setPlayingLocal] = useState(false);
  const setPlaying = setPlayingLocal;
  const [loading, setLoading] = useState(true);
  const [, setPlaybackModeLocal] = useState<MusicPlaybackMode>("music");
  const setPlaybackMode = setPlaybackModeLocal;

  const playbackSnapshot = usePlaybackSnapshot();
  /**
   * **主轨**（音乐或读经）在出声。金句不算——它是叠在背景上的独立一条，
   * 有它自己的状态可读（`usePlaybackStream("verse")`）。
   *
   * 一度把三条流都 OR 进来，结果金句在播时首页音乐键被判成「音乐在播」，
   * 按下去执行了暂停（2026-09-08 真机复现：点音乐没有 Play MUSIC）。
   * 这个共用值的历史语义一直只涵盖主轨，扩大它就等于把旧毛病换个地方再犯一次。
   */
  const playing = playbackSnapshot.scripture.uri
    ? playbackSnapshot.scripture.playing
    : playbackSnapshot.music.playing;
  /**
   * 主轨此刻是读经还是音乐。以「读经这条流有没有音轨」为准——
   * 暂停中的读经仍算 scripture 模式，坞里的续播键才不会跳成音乐。
   */
  const playbackMode: MusicPlaybackMode = useMemo(
    () => (playbackSnapshot.scripture.uri ? "scripture" : "music"),
    [playbackSnapshot.scripture.uri],
  );
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
