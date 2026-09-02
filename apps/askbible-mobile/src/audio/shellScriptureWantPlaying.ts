import { createWantPlayingStore } from "./createWantPlayingStore";

const store = createWantPlayingStore();

export function getShellScriptureWantPlaying(): boolean {
  return store.get();
}

export function setShellScriptureWantPlaying(next: boolean): void {
  store.set(next);
}

export function subscribeShellScriptureWantPlaying(onChange: () => void): () => void {
  return store.subscribe(onChange);
}
