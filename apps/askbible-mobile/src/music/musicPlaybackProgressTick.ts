import { useSyncExternalStore } from "react";

export type MusicPlaybackProgressTick = {
  musicCurrentSec: number;
  scriptureCurrentSec: number;
};

const listeners = new Set<() => void>();
let snapshot: MusicPlaybackProgressTick = {
  musicCurrentSec: 0,
  scriptureCurrentSec: 0,
};

export function subscribeMusicPlaybackProgressTick(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMusicPlaybackProgressTickSnapshot(): MusicPlaybackProgressTick {
  return snapshot;
}

/** 进度条 / 时钟 UI 专用；不写入 MusicPlayback Context，避免整树每 250ms 重渲染。 */
export function publishMusicPlaybackProgressTick(
  musicCurrentSec: number,
  scriptureCurrentSec: number,
): void {
  if (
    musicCurrentSec === snapshot.musicCurrentSec &&
    scriptureCurrentSec === snapshot.scriptureCurrentSec
  ) {
    return;
  }
  snapshot = { musicCurrentSec, scriptureCurrentSec };
  // Provider 渲染路径会 publish；同步通知会触发订阅方 setState（MusicHomeScreen），
  // 导致 “Cannot update a component while rendering a different component”。
  queueMicrotask(() => {
    for (const listener of listeners) {
      listener();
    }
  });
}

export function useMusicPlaybackProgressTick(): MusicPlaybackProgressTick {
  return useSyncExternalStore(
    subscribeMusicPlaybackProgressTick,
    getMusicPlaybackProgressTickSnapshot,
    getMusicPlaybackProgressTickSnapshot,
  );
}
