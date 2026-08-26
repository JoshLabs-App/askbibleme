import { useMemo, useSyncExternalStore } from "react";
import {
  getShellMusicNativePlaying,
  subscribeShellMusicNativePlaying,
} from "../audio/shellMusicNativePlaying";
import {
  getShellMusicWantPlaying,
  subscribeShellMusicWantPlaying,
} from "../audio/shellMusicWantPlaying";

export type ShellMusicSignals = {
  /** 用户意图：点过播放且未主动停。 */
  wantPlaying: boolean;
  /** 原生播放器心跳。 */
  nativePlaying: boolean;
};

/** 壳层音乐的两路外部信号；UI 一律从这里取，不要各自订阅。 */
export function useShellMusicSignals(): ShellMusicSignals {
  const wantPlaying = useSyncExternalStore(
    subscribeShellMusicWantPlaying,
    getShellMusicWantPlaying,
    getShellMusicWantPlaying,
  );
  const nativePlaying = useSyncExternalStore(
    subscribeShellMusicNativePlaying,
    getShellMusicNativePlaying,
    getShellMusicNativePlaying,
  );
  return useMemo(() => ({ wantPlaying, nativePlaying }), [nativePlaying, wantPlaying]);
}

/**
 * 音乐是否在出声（首页专辑黄标用）。
 * iOS 原生播放时 JS 的 playing 会抖 false，必须三路取或。
 * 读经与音乐共用 playing：mode≠music 时绝不能当音乐在播，否则回首页专辑会误黄。
 */
export function isShellMusicOn(
  signals: ShellMusicSignals,
  jsPlaying: boolean,
  playbackMode?: string,
): boolean {
  if (playbackMode != null && playbackMode !== "music") return false;
  return signals.wantPlaying || signals.nativePlaying || jsPlaying;
}
