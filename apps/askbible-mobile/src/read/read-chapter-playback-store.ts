import type { ReadChapterPlaybackRegistration } from "../music/MusicPlaybackContext";

/** 当前经文章播放注册（避免 effect 清理与底栏点击竞态导致误播音乐） */
let active: ReadChapterPlaybackRegistration | null = null;
const listeners = new Set<() => void>();

export function setActiveReadChapterPlayback(reg: ReadChapterPlaybackRegistration | null): void {
  active = reg;
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function getActiveReadChapterPlayback(): ReadChapterPlaybackRegistration | null {
  return active;
}

export function subscribeActiveReadChapterPlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
