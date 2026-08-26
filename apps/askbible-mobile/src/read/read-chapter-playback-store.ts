import type { ReadChapterPlaybackRegistration } from "../music/scripturePlaybackTypes";

/**
 * Browse vs Playing 分离：
 * - browse：章页 UI 正在看的注册（换章浏览会变）
 * - playing：实际音轨注册（锁屏 Next/Prev、章末续播只读它）
 *
 * getActiveReadChapterPlayback = browse（兼容旧名）。
 */

let browse: ReadChapterPlaybackRegistration | null = null;
let playing: ReadChapterPlaybackRegistration | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function sameChapter(
  a: ReadChapterPlaybackRegistration | null,
  b: ReadChapterPlaybackRegistration | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.bookId === b.bookId && a.chapter === b.chapter && a.translationId === b.translationId;
}

/** @deprecated 语义上是 browse；锁屏运输请用 resolveTransportReadChapterPlayback */
export function setActiveReadChapterPlayback(reg: ReadChapterPlaybackRegistration | null): void {
  setBrowseReadChapterPlayback(reg);
}

export function setBrowseReadChapterPlayback(reg: ReadChapterPlaybackRegistration | null): void {
  if (browse === reg) return;
  browse = reg;
  notify();
}

export function getActiveReadChapterPlayback(): ReadChapterPlaybackRegistration | null {
  return browse;
}

export function getBrowseReadChapterPlayback(): ReadChapterPlaybackRegistration | null {
  return browse;
}

export function setPlayingReadChapterPlayback(reg: ReadChapterPlaybackRegistration | null): void {
  if (playing === reg) return;
  // 同章仅换回调/src 时仍要更新引用，供锁屏拿到最新 onAdvance*。
  if (sameChapter(playing, reg) && reg != null) {
    playing = reg;
    notify();
    return;
  }
  playing = reg;
  notify();
}

export function getPlayingReadChapterPlayback(): ReadChapterPlaybackRegistration | null {
  return playing;
}

export function clearPlayingReadChapterPlayback(): void {
  if (playing == null) return;
  playing = null;
  notify();
}

/** 锁屏 / 导航 / 章末：优先实际在播轨。 */
export function resolveTransportReadChapterPlayback(): ReadChapterPlaybackRegistration | null {
  return playing ?? browse;
}

export function subscribeActiveReadChapterPlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 测用：重置 browse + playing。 */
export function resetReadChapterPlaybackStoresForTests(): void {
  browse = null;
  playing = null;
  notify();
}
