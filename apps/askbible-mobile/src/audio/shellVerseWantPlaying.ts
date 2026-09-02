import { createWantPlayingStore } from "./createWantPlayingStore";

const store = createWantPlayingStore();

export function getShellVerseWantPlaying(): boolean {
  return store.get();
}

export function setShellVerseWantPlaying(next: boolean): void {
  store.set(next);
}

export function subscribeShellVerseWantPlaying(onChange: () => void): () => void {
  return store.subscribe(onChange);
}
