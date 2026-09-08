import { getPlaybackSnapshot, usePlaybackStream } from "../audio/playbackState";

export type ShellMusicSignals = {
  /**
   * 用户意图仍然成立：点过播放，且没有按过音乐这一路的暂停。
   *
   * 原生的 `wantPlaying` 只说明「起过播、音轨还挂着」，用户暂停后仍是 true；
   * 拿它点灯就会「黄着却没声」，所以这里先减掉 userPaused 再交给界面。
   */
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
  return { wantPlaying: music.wantPlaying && !music.userPaused, nativePlaying: music.playing };
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
