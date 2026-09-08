import { getPlaybackSnapshot, usePlaybackStream } from "../audio/playbackState";

export type ShellMusicSignals = {
  /** 用户意图：点过播放且未主动停。 */
  wantPlaying: boolean;
  /** 此刻真的在出声。 */
  nativePlaying: boolean;
};

/**
 * 壳层音乐的状态。UI 一律从这里取。
 *
 * 以前这里订阅两个 JS 影子 store（`shellMusicWantPlaying` / `shellMusicNativePlaying`），
 * 因为没有任何一个能单独说清「音乐在不在响」。现在原生按流上报，直接读它。
 */
export function useShellMusicSignals(): ShellMusicSignals {
  const music = usePlaybackStream("music");
  return { wantPlaying: music.wantPlaying, nativePlaying: music.playing };
}

/**
 * 音乐是否在出声（首页专辑黄标用）。
 *
 * 原本要「三路取或」：JS 的 playing 在原生接管时会抖 false，还得额外判断 playbackMode
 * 免得读经把音乐标黄。现在只问音乐这一条流，这些补偿都不需要了。
 * 参数保留是为了不改动调用方，实际只用第一个。
 */
export function isShellMusicOn(
  signals: ShellMusicSignals,
  _jsPlaying?: boolean,
  _playbackMode?: string,
): boolean {
  return signals.nativePlaying || signals.wantPlaying;
}


/**
 * 首页/壳层音乐图标是否点亮。
 *
 * `playing` 是真的在响，`wantPlaying` 覆盖「刚点下、还在缓冲」那一瞬。
 * 以前要凑 playbackMode + playing + wantPlaying + nativePlaying 四个来源，
 * 因为没有一个能单独说清；原生按流上报后只需这两个。
 */
export function isShellMusicChromeActive(args: {
  musicPlaying: boolean;
  musicWantPlaying: boolean;
}): boolean {
  return args.musicPlaying || args.musicWantPlaying;
}
