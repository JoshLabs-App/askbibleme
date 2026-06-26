import { useSyncExternalStore } from "react";

const scripturePlaybackSecStore = {
  current: 0,
  listeners: new Set<() => void>(),
};

function subscribeScripturePlaybackSec(listener: () => void): () => void {
  scripturePlaybackSecStore.listeners.add(listener);
  return () => {
    scripturePlaybackSecStore.listeners.delete(listener);
  };
}

export function getScripturePlaybackSecSnapshot(): number {
  return scripturePlaybackSecStore.current;
}

export function publishScripturePlaybackSec(sec: number): void {
  if (sec === scripturePlaybackSecStore.current) return;
  scripturePlaybackSecStore.current = sec;
  for (const listener of scripturePlaybackSecStore.listeners) {
    listener();
  }
}

/** 经文高亮/跟读用：不受进度条 UI 节流影响 */
export function useScripturePlaybackSec(): number {
  return useSyncExternalStore(
    subscribeScripturePlaybackSec,
    getScripturePlaybackSecSnapshot,
    getScripturePlaybackSecSnapshot,
  );
}
