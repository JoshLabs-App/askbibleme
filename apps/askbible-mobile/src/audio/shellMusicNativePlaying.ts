/** iOS：原生音乐引擎最近一次上报是否在播（与 JS `playing` / wantPlaying 解耦）。 */
let shellMusicNativePlaying = false;
const listeners = new Set<() => void>();

export function getShellMusicNativePlaying(): boolean {
  return shellMusicNativePlaying;
}

export function setShellMusicNativePlaying(next: boolean): void {
  if (shellMusicNativePlaying === next) return;
  shellMusicNativePlaying = next;
  for (const listener of listeners) listener();
}

/**
 * 首页/壳层音乐图标是否应显示 LOGO 色。
 *
 * 只问音乐这一条流：`playing` 是真的在响，`wantPlaying` 覆盖「刚点下、还在缓冲」那一瞬。
 * 以前要凑 playbackMode + playing + wantPlaying + nativePlaying 四个来源，
 * 是因为没有一个能单独说清；现在原生按流上报了。
 */
export function isShellMusicChromeActive(args: {
  musicPlaying: boolean;
  musicWantPlaying: boolean;
}): boolean {
  return args.musicPlaying || args.musicWantPlaying;
}
