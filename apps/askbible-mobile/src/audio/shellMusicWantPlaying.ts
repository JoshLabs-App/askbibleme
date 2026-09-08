import {
  applyOptimisticIntent,
  getPlaybackSnapshot,
  isStreamWanted,
  subscribePlaybackState,
} from "./playbackState";

/**
 * 用户是否仍要求壳层音乐在播。
 *
 * 这里曾是一份独立的 JS boolean store（`createWantPlayingStore`），与原生各写各的：
 * 原生按流记着 `wantPlaying` / `userPaused`，JS 另存一份自己的答案，两边不同步时
 * 没人会发现——「黄着却没声」「点了没反应」都是从这道缝里出来的。
 *
 * 现在读写都落在同一份快照上：读取问原生上报的状态，写入先落一个乐观值、
 * 等原生回执覆盖。函数名与签名保持不变，调用方不必关心这件事。
 */
export function getShellMusicWantPlaying(): boolean {
  return isStreamWanted(getPlaybackSnapshot().music);
}

/** 意图发生变化（点播/停）。原生回执到达前先让本地快照答得上话。 */
export function setShellMusicWantPlaying(next: boolean): void {
  applyOptimisticIntent(
    "music",
    next ? { wantPlaying: true, userPaused: false } : { wantPlaying: false },
  );
}

/**
 * 只在这个布尔值真的翻转时通知。
 *
 * 快照每秒都因进度上报而变一次，直接转发会把订阅方（唤醒/静音判断等）
 * 每秒叫醒一遍——它们关心的只是「还想不想播」有没有变。
 */
export function subscribeShellMusicWantPlaying(listener: () => void): () => void {
  let last = getShellMusicWantPlaying();
  return subscribePlaybackState(() => {
    const next = getShellMusicWantPlaying();
    if (next === last) return;
    last = next;
    listener();
  });
}
