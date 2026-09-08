import { useSyncExternalStore } from "react";

/**
 * 三条流的播放状态，由原生推来。
 *
 * **这是 JS 侧关于「现在在播什么」的唯一来源。** 组件读这里，不要再自己记。
 *
 * 为什么必须这样：旧代码里 JS 维护 `playing` / `playbackMode` 两个**共用**状态，
 * 音乐、读经、金句都读同一份，于是同一个按钮的图标和点击处理可能得出不同答案——
 * 2026-09-08 实测「播着音乐点读经没反应」就是这么来的：图标判断
 * `playbackMode === "scripture" && playing`，点击处理只判断 `playing`，
 * 音乐在放时后者为真，按下去执行了暂停。
 *
 * 原生那边三条流各有各的状态（见 model/PlaybackModel），这里原样镜像，不做二次推导。
 *
 * 本文件**刻意不 import react-native**：测试环境里 RN 的源码是 Flow 语法，
 * 解析不了，任何间接引到这里的单测都会整体挂掉。事件监听在 shellMediaControls 里挂。
 */

export type PlaybackStreamId = "music" | "scripture" | "verse";

export type PlaybackStreamState = {
  /** 此刻真的该出声。已把用户暂停与系统打断算进去——直接用它，别再自己叠条件。 */
  playing: boolean;
  /** 用户/JS 的意图；与 `playing` 的差别在于是否被暂停或打断。 */
  wantPlaying: boolean;
  userPaused: boolean;
  uri: string | null;
  positionSec: number;
  durationSec: number;
  queueLength: number;
  title: string;
  artist: string;
  album: string;
};

export type PlaybackSnapshot = {
  music: PlaybackStreamState;
  scripture: PlaybackStreamState;
  verse: PlaybackStreamState;
  systemInterrupted: boolean;
  /** 锁屏 / 通知栏此刻代表哪一条流。 */
  nowPlayingStream: PlaybackStreamId | null;
};

const EMPTY_STREAM: PlaybackStreamState = {
  playing: false,
  wantPlaying: false,
  userPaused: false,
  uri: null,
  positionSec: 0,
  durationSec: 0,
  queueLength: 0,
  title: "",
  artist: "",
  album: "",
};

const EMPTY: PlaybackSnapshot = {
  music: EMPTY_STREAM,
  scripture: EMPTY_STREAM,
  verse: EMPTY_STREAM,
  systemInterrupted: false,
  nowPlayingStream: null,
};

let snapshot: PlaybackSnapshot = EMPTY;
const listeners = new Set<() => void>();

function normalizeStream(raw: unknown): PlaybackStreamState {
  const o = (raw ?? {}) as Record<string, unknown>;
  const uri = typeof o.uri === "string" && o.uri.trim() ? o.uri : null;
  return {
    playing: o.playing === true,
    wantPlaying: o.wantPlaying === true,
    userPaused: o.userPaused === true,
    uri,
    positionSec: typeof o.positionSec === "number" ? o.positionSec : 0,
    durationSec: typeof o.durationSec === "number" ? o.durationSec : 0,
    queueLength: typeof o.queueLength === "number" ? o.queueLength : 0,
    title: typeof o.title === "string" ? o.title : "",
    artist: typeof o.artist === "string" ? o.artist : "",
    album: typeof o.album === "string" ? o.album : "",
  };
}

function normalize(raw: unknown): PlaybackSnapshot {
  const o = (raw ?? {}) as Record<string, unknown>;
  const now = o.nowPlayingStream;
  return {
    music: normalizeStream(o.music),
    scripture: normalizeStream(o.scripture),
    verse: normalizeStream(o.verse),
    systemInterrupted: o.systemInterrupted === true,
    nowPlayingStream:
      now === "music" || now === "scripture" || now === "verse" ? now : null,
  };
}

/** 原生推来的新状态。事件名与两端的 PlaybackStateBridge 一致。 */
export function applyNativePlaybackState(raw: unknown): void {
  snapshot = normalize(raw);
  for (const listener of listeners) listener();
}

export function getPlaybackSnapshot(): PlaybackSnapshot {
  return snapshot;
}

export function subscribePlaybackState(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** 订阅整份快照。 */
export function usePlaybackSnapshot(): PlaybackSnapshot {
  return useSyncExternalStore(subscribePlaybackState, getPlaybackSnapshot, () => EMPTY);
}

/** 订阅某一条流。组件通常只关心其中一条。 */
export function usePlaybackStream(stream: PlaybackStreamId): PlaybackStreamState {
  return usePlaybackSnapshot()[stream];
}

/**
 * 主轨此刻是读经还是音乐。
 *
 * 以「读经这条流有没有音轨」为准——暂停中的读经仍算 scripture 模式，坞里的续播键
 * 才不会跳成音乐。同步读取，异步流程里也能用。
 *
 * 取代了 `playbackModeRef`：那是个每次渲染都会被覆盖的镜像，中途几处「抢答式」写入
 * 只能撑到下一次渲染，依赖它的判断本来就不牢靠。
 */
export function getShellPlaybackMode(): "music" | "scripture" {
  return snapshot.scripture.uri ? "scripture" : "music";
}

/**
 * 这一路的播放意图此刻是否成立：起过播，且用户没有按过它的暂停。
 *
 * 原生的 `wantPlaying` 单独看是不够的——用户暂停后它仍是 true（音轨还挂着，
 * 按播放键要能原样接上）。想问「用户还要不要这一路」就得减掉 userPaused。
 */
export function isStreamWanted(stream: PlaybackStreamState): boolean {
  return stream.wantPlaying && !stream.userPaused;
}

/**
 * 意图刚发给原生、回执还没到时，先把这一路的意图位落到本地快照。
 *
 * 没有这一步就得让 JS 另存一份 `shellXWantPlaying`，于是同一件事有两个存放处——
 * 那正是这轮重构在拆掉的东西。原生下一次上报会整份覆盖，这里写的只活一个来回。
 */
export function applyOptimisticIntent(
  stream: PlaybackStreamId,
  intent: { wantPlaying?: boolean; userPaused?: boolean },
): void {
  const before = snapshot[stream];
  const after = { ...before, ...intent };
  if (after.wantPlaying === before.wantPlaying && after.userPaused === before.userPaused) return;
  snapshot = { ...snapshot, [stream]: after };
  for (const listener of listeners) listener();
}

/**
 * 这一路该不该点亮（黄标）。
 *
 * 「在响」或「刚点下、还在缓冲」都算亮；**用户按过这一路的暂停就不算**。
 * 原生的 `wantPlaying` 只表示「起过播、音轨还挂着」，用户暂停后它仍是 true——
 * 直接拿它点灯就会出现 Josh 报过的「黄着却没声」（2026-09-08 真机：关掉音乐后
 * 首页音符仍是黄的）。判断只此一处，各处 UI 都调它。
 */
export function isStreamLit(stream: PlaybackStreamState): boolean {
  return stream.playing || isStreamWanted(stream);
}
