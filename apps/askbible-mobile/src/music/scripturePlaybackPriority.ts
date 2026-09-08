import { getShellPlaybackMode } from "../audio/playbackState";
import type { AudioPlayer } from "expo-audio";
import type { MutableRefObject } from "react";
import { peekReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";

/** 判断「圣经朗读会话是否应受保护、不被音乐抢占」所需的 ref 集合。 */
export type ScripturePriorityRefs = {
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scripturePlayInFlightRef: MutableRefObject<Promise<void> | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
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
  if (isScriptureChapterHandoffActive(refs.scriptureChapterHandoffRef)) return true;
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

export function markScriptureChapterHandoff(ref?: MutableRefObject<boolean>): void {
  readingHandoffActive = true;
  if (ref) ref.current = true;
}

export function clearScriptureChapterHandoff(ref?: MutableRefObject<boolean>): void {
  readingHandoffActive = false;
  if (ref) ref.current = false;
}

export function isScriptureChapterHandoffActive(ref?: MutableRefObject<boolean>): boolean {
  return readingHandoffActive || Boolean(ref?.current);
}
