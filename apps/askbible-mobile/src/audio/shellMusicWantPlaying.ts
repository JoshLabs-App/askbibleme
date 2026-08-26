/** 用户是否仍要求壳层音乐在播（与 UI `playing` / 系统真实 isPlaying 解耦）。 */
let shellMusicWantPlaying = false;
const listeners = new Set<() => void>();

export function getShellMusicWantPlaying(): boolean {
  return shellMusicWantPlaying;
}

export function setShellMusicWantPlaying(next: boolean): void {
  if (shellMusicWantPlaying === next) return;
  shellMusicWantPlaying = next;
  for (const listener of listeners) listener();
}

export function subscribeShellMusicWantPlaying(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
