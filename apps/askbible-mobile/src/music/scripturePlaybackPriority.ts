import { getShellPlaybackMode } from "../audio/playbackState";
import type { AudioPlayer } from "expo-audio";
import type { MutableRefObject } from "react";
import { peekReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";

/** 判断「圣经朗读会话是否应受保护、不被音乐抢占」所需的 ref 集合。 */
export type ScripturePriorityRefs = {
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scripturePlayInFlightRef: MutableRefObject<Promise<void> | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
};

export type ScripturePriorityState = {
  playing?: boolean;
  scripturePreparing?: boolean;
};

let readingHandoffActive = false;

/** 当前是否处于应保护的圣经朗读会话（含 planFlow 续章 handoff）。 */
export function isScripturePlaybackProtected(
  refs: ScripturePriorityRefs,
  state: ScripturePriorityState = {},
): boolean {
  if (getShellPlaybackMode() !== "scripture") return false;
  if (state.scripturePreparing) return true;
  if (refs.scriptureWantPlayingRef.current) return true;
  if (refs.scripturePlayInFlightRef.current) return true;
  if (refs.autoPlayScriptureRef.current) return true;
  if (isScriptureChapterHandoffActive()) return true;
  if (peekReadPlanFlowAutoplay()) return true;
  return false;
}

/**
 * 用户主动播音乐：释放 shell 上的圣经会话（含 planFlow 自动续章意图）。
 *
 * 当前主轨是谁由原生状态回答，不再传 JS 镜像 ref 进来。
 */
export async function releaseScriptureShellForMusic(
  stopScripturePlayback: () => Promise<void>,
): Promise<void> {
  if (getShellPlaybackMode() !== "scripture") return;
  await stopScripturePlayback();
}

/**
 * 换章交接锁：上一章刚结束、下一章还没接上的那段时间，别让别人抢走读经会话。
 *
 * 这个标志只住在这里。它一度还有一份 `scriptureChapterHandoffRef` 被穿过十几个
 * 文件，判断时两者取或——两边不同步时没有任何报错，只是锁时灵时不灵。
 */
export function markScriptureChapterHandoff(): void {
  readingHandoffActive = true;
}

export function clearScriptureChapterHandoff(): void {
  readingHandoffActive = false;
}

export function isScriptureChapterHandoffActive(): boolean {
  return readingHandoffActive;
}
