import { createWantPlayingStore } from "./createWantPlayingStore";

/** 用户是否仍要求壳层音乐在播（与 UI `playing` / 系统真实 isPlaying 解耦）。 */
const store = createWantPlayingStore();

export function getShellMusicWantPlaying(): boolean {
  return store.get();
}

export function setShellMusicWantPlaying(next: boolean): void {
  store.set(next);
}

export function subscribeShellMusicWantPlaying(listener: () => void): () => void {
  return store.subscribe(listener);
}
