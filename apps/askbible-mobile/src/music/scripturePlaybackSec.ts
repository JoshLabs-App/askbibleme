import { useSyncExternalStore } from "react";

const HIGHLIGHT_TICK_MS = 500;

const scripturePlaybackSecStore = {
  current: 0,
  listeners: new Set<() => void>(),
};

const clock = {
  sec: 0,
  atMs: 0,
  playing: false,
  rate: 1,
};

let highlightTick: number | null = null;
// 进度插值计时器只服务可见 UI（进度轴 Animated）。后台播放时看不见，却会烧 JS CPU：
// 带 audio 后台模式的 App 若 60 秒内平均 CPU 超 80%，会被 iOS 直接杀掉。
let uiForeground = true;

function notifyScripturePlaybackSec(): void {
  for (const listener of scripturePlaybackSecStore.listeners) {
    listener();
  }
}

function interpolatedSec(): number {
  if (!clock.playing) return clock.sec;
  const elapsed = (Date.now() - clock.atMs) / 1000;
  return clock.sec + elapsed * clock.rate;
}

function publishInterpolatedSec(): void {
  scripturePlaybackSecStore.current = interpolatedSec();
  notifyScripturePlaybackSec();
}

function syncHighlightTicker(): void {
  if (clock.playing && uiForeground) {
    if (highlightTick) return;
    highlightTick = setInterval(() => {
      publishInterpolatedSec();
    }, HIGHLIGHT_TICK_MS) as unknown as number;
    return;
  }
  if (!highlightTick) return;
  clearInterval(highlightTick);
  highlightTick = null;
}

export function subscribeScripturePlaybackSec(listener: () => void): () => void {
  scripturePlaybackSecStore.listeners.add(listener);
  return () => {
    scripturePlaybackSecStore.listeners.delete(listener);
  };
}

export function getScripturePlaybackSecSnapshot(): number {
  return scripturePlaybackSecStore.current;
}

/**
 * 当前真实播放秒数，随时算随时准，不依赖高亮计时器。
 * 非 UI 场景（如给系统媒体控制上报位置）必须用这个，不要用 React 快照——
 * 快照在后台会停止推进。
 */
export function getScripturePlaybackSecNow(): number {
  return interpolatedSec();
}

/** 由 App 前后台状态驱动；后台停掉高亮计时器，回前台立刻补一次。 */
export function setScripturePlaybackSecForeground(next: boolean): void {
  if (uiForeground === next) return;
  uiForeground = next;
  publishInterpolatedSec();
  syncHighlightTicker();
}

export function setScripturePlaybackClockPlaying(playing: boolean, rate = 1): void {
  const nextRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  if (clock.playing === playing && clock.rate === nextRate) {
    syncHighlightTicker();
    return;
  }
  clock.sec = interpolatedSec();
  clock.atMs = Date.now();
  clock.playing = playing;
  clock.rate = nextRate;
  scripturePlaybackSecStore.current = clock.sec;
  syncHighlightTicker();
  notifyScripturePlaybackSec();
}

export function publishScripturePlaybackSec(sec: number): void {
  if (!Number.isFinite(sec)) return;
  const next = Math.max(0, sec);
  if (next === clock.sec) {
    clock.atMs = Date.now();
    return;
  }
  clock.sec = next;
  clock.atMs = Date.now();
  scripturePlaybackSecStore.current = next;
  notifyScripturePlaybackSec();
}

/** 经文高亮/跟读用：不受进度条 UI 节流影响 */
export function useScripturePlaybackSec(): number {
  return useSyncExternalStore(
    subscribeScripturePlaybackSec,
    getScripturePlaybackSecSnapshot,
    getScripturePlaybackSecSnapshot,
  );
}
