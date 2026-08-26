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

export function subscribeShellMusicNativePlaying(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 首页/壳层音乐图标是否应显示 LOGO 色。 */
export function isShellMusicChromeActive(args: {
  playbackMode: "music" | "scripture" | string;
  playing: boolean;
  wantPlaying: boolean;
  nativePlaying?: boolean;
}): boolean {
  if (args.playbackMode !== "music") return false;
  // wantPlaying：点播当下就要亮中间键；勿只等原生心跳，否则有声却像未激活。
  return args.wantPlaying || args.playing || !!args.nativePlaying;
}
