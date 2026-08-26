import { useSyncExternalStore } from "react";
import {
  getMusicPlaybackProgressTickSnapshot,
  subscribeMusicPlaybackProgressTick,
} from "../music/musicPlaybackProgressTick";
import {
  getScripturePlaybackSecSnapshot,
  subscribeScripturePlaybackSec,
} from "../music/scripturePlaybackSec";

function subscribeFollowSec(listener: () => void): () => void {
  const unsubHighlight = subscribeScripturePlaybackSec(listener);
  const unsubProgress = subscribeMusicPlaybackProgressTick(listener);
  return () => {
    unsubHighlight();
    unsubProgress();
  };
}

function followSec(): number {
  return Math.max(
    getScripturePlaybackSecSnapshot(),
    getMusicPlaybackProgressTickSnapshot().scriptureCurrentSec,
  );
}

/**
 * 在订阅层就把「播放秒数」收敛成粗粒度派生值。
 *
 * 秒数每 120ms 推一次，但高亮到第几节要几秒才变一次。直接订阅秒数会让整章
 * 经文列表每秒白重渲染 8 次；换成派生值后 useSyncExternalStore 在快照不变时
 * 直接跳过重渲染。
 *
 * select 必须返回原始值：useSyncExternalStore 用 Object.is 比较，返回对象
 * 会每次都判定为变化，反而永远无法跳过。
 */
export function useScriptureFollowDerived<T extends string | number | boolean | null>(
  select: (sec: number) => T,
): T {
  const read = () => select(followSec());
  return useSyncExternalStore(subscribeFollowSec, read, read);
}
