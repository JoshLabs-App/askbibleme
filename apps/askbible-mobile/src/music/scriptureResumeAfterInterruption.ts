import type { AudioPlayer } from "expo-audio";
import type { MutableRefObject } from "react";
import { getShellAudioInterrupted } from "../audio/shellAudioInterruption";
import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import { safeGetSoundStatus, safePlaySound } from "../audio/safeShellSound";
import {
  getActiveReadChapterPlayback,
  resolveTransportReadChapterPlayback,
} from "../read/read-chapter-playback-store";
import {
  isPlanFlowChapterAdvanceInFlight,
  peekReadPlanFlowAutoplay,
} from "../read/read-plan-flow-autoplay";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import { isScriptureUserPauseHeld } from "./scriptureUserPause";
import {
  finishScriptureChapterOnce,
  isScriptureChapterEndStalled,
  isScriptureNearChapterEnd,
  noteScripturePlaybackProgress,
  shouldScheduleScriptureMidChapterResume,
  type ScriptureChapterEndFinishArgs,
} from "./scriptureChapterEnd";
import { isScriptureChapterHandoffActive } from "./scripturePlaybackPriority";
import type { ReadChapterPlaybackRegistration, ScriptureAudioRepeatMode } from "./scripturePlaybackTypes";

export type ScriptureResumeCtx = {
  playbackModeRef: MutableRefObject<"music" | "scripture">;
  soundRef: MutableRefObject<AudioPlayer | null>;
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scripturePlayInFlightRef: MutableRefObject<Promise<void> | null>;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  setPlaying: (playing: boolean) => void;
};

export type ScriptureBackgroundRecoveryCtx = ScriptureResumeCtx & {
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  scriptureChapterEndHandledRef: MutableRefObject<boolean>;
  scriptureLastProgressMsRef: MutableRefObject<number>;
  scriptureLastProgressAtRef: MutableRefObject<number>;
  scriptureSrcRef: MutableRefObject<string | null>;
  tryPlayScriptureWithFallback: (
    reg: ReadChapterPlaybackRegistration,
    preferredSrc: string,
    playingReg?: ReadChapterPlaybackRegistration | null,
  ) => Promise<boolean>;
};

let resumeTimer: ReturnType<typeof setTimeout> | null = null;

export function clearScriptureResumeTimer(): void {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

export function markScriptureWantPlaying(ref: MutableRefObject<boolean>, want: boolean): void {
  ref.current = want;
}

export {
  holdScriptureUserPause,
  isScriptureUserPauseHeld,
  releaseScriptureUserPause,
} from "./scriptureUserPause";

function resolveReadChapterForRecovery(
  ctx: ScriptureBackgroundRecoveryCtx,
): ReadChapterPlaybackRegistration | null {
  return resolveTransportReadChapterPlayback() ?? ctx.readChapterRef.current ?? getActiveReadChapterPlayback();
}

function wantsScripturePlayback(ctx: ScriptureBackgroundRecoveryCtx): boolean {
  if (isScriptureUserPauseHeld()) return false;
  // 用户主动暂停后 want/autoPlay 均为 false：即使 planFlow autoplay 仍 armed 也不得强行续播。
  if (!ctx.scriptureWantPlayingRef.current && !ctx.autoPlayScriptureRef.current) {
    return false;
  }
  return (
    ctx.scriptureWantPlayingRef.current ||
    ctx.autoPlayScriptureRef.current ||
    peekReadPlanFlowAutoplay()
  );
}

function chapterEndFinishArgs(ctx: ScriptureBackgroundRecoveryCtx): ScriptureChapterEndFinishArgs {
  return {
    soundRef: ctx.soundRef,
    scriptureSrcRef: ctx.scriptureSrcRef,
    scriptureAudioRepeatRef: ctx.scriptureAudioRepeatRef,
    readChapterRef: ctx.readChapterRef,
    autoPlayScriptureRef: ctx.autoPlayScriptureRef,
    scriptureChapterHandoffRef: ctx.scriptureChapterHandoffRef,
    scriptureWantPlayingRef: ctx.scriptureWantPlayingRef,
    setPlaying: ctx.setPlaying,
    chapterEndHandledRef: ctx.scriptureChapterEndHandledRef,
  };
}

export function scheduleScriptureResumeAfterInterruption(ctx: ScriptureResumeCtx): void {
  if (getShellAudioInterrupted()) return;
  if (!ctx.scriptureWantPlayingRef.current) return;
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    void tryResumeScriptureAfterInterruption(ctx);
  }, 450);
}

export function scheduleScriptureBackgroundRecovery(ctx: ScriptureBackgroundRecoveryCtx): void {
  if (getShellAudioInterrupted()) return;
  if (!wantsScripturePlayback(ctx)) return;
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    void recoverScripturePlaybackAfterBackground(ctx);
  }, 450);
}

export async function tryResumeScriptureAfterInterruption(ctx: ScriptureResumeCtx): Promise<boolean> {
  if (getShellAudioInterrupted()) return false;
  if (!ctx.scriptureWantPlayingRef.current) return false;
  if (ctx.playbackModeRef.current !== "scripture") return false;
  if (ctx.scripturePlayInFlightRef.current) return false;
  if (ctx.scriptureStopAtSecRef.current != null) return false;

  const sound = ctx.soundRef.current;
  if (!sound) return false;

  const st = await safeGetSoundStatus(sound);
  if (!st?.isLoaded || st.isPlaying) return false;

  const durationMs = st.durationMillis ?? 0;
  const positionMs = st.positionMillis ?? 0;
  if (!shouldScheduleScriptureMidChapterResume(positionMs, durationMs)) {
    return false;
  }

  await configureScriptureShellAudioMode();
  const ok = await safePlaySound(sound);
  ctx.setPlaying(ok);
  return ok;
}

async function flushPlanFlowAutoplayRegistration(ctx: ScriptureBackgroundRecoveryCtx): Promise<boolean> {
  if (isScriptureUserPauseHeld()) return false;
  if (ctx.scripturePlayInFlightRef.current) return false;
  if (scriptureChapterPool.isActive()) {
    return scriptureChapterPool.retryCurrent();
  }
  if (!peekReadPlanFlowAutoplay() && !ctx.autoPlayScriptureRef.current) return false;
  const rc = resolveReadChapterForRecovery(ctx);
  const src = rc?.chapterAudioSrc?.trim();
  if (!rc || !src) return false;
  markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
  return ctx.tryPlayScriptureWithFallback(rc, src, null);
}

/**
 * 轮询章末 stall（isPlaying 但位置不动时 status 回调可能仍触发，此处作兜底）。
 */
export async function watchScriptureChapterEndStall(
  ctx: ScriptureBackgroundRecoveryCtx,
): Promise<boolean> {
  if (ctx.playbackModeRef.current !== "scripture") return false;
  if (ctx.scripturePlayInFlightRef.current) return false;
  if (ctx.scriptureStopAtSecRef.current != null) return false;
  if (!wantsScripturePlayback(ctx)) return false;
  if (isPlanFlowChapterAdvanceInFlight() || scriptureChapterPool.shouldPreservePlaybackOnUIUnmount()) return false;

  const sound = ctx.soundRef.current;
  if (!sound) return false;

  const st = await safeGetSoundStatus(sound);
  if (!st?.isLoaded) return false;

  const durationMs = st.durationMillis ?? 0;
  const positionMs = st.positionMillis ?? 0;
  noteScripturePlaybackProgress(positionMs, ctx.scriptureLastProgressMsRef, ctx.scriptureLastProgressAtRef);

  if (
    !isScriptureChapterEndStalled(
      positionMs,
      durationMs,
      ctx.scriptureLastProgressMsRef,
      ctx.scriptureLastProgressAtRef,
    )
  ) {
    return false;
  }

  markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
  ctx.autoPlayScriptureRef.current = true;
  return finishScriptureChapterOnce(chapterEndFinishArgs(ctx));
}

/**
 * 锁屏/后台恢复：章中暂停则续播；章末则触发 planFlow 续下一章；已换章但未开播则补播。
 */
export async function recoverScripturePlaybackAfterBackground(
  ctx: ScriptureBackgroundRecoveryCtx,
): Promise<boolean> {
  if (getShellAudioInterrupted()) return false;
  if (isScriptureUserPauseHeld()) return false;
  if (ctx.scripturePlayInFlightRef.current) return false;
  if (ctx.scriptureStopAtSecRef.current != null) return false;
  if (!wantsScripturePlayback(ctx)) return false;

  if (ctx.playbackModeRef.current !== "scripture") {
    return flushPlanFlowAutoplayRegistration(ctx);
  }

  const stalled = await watchScriptureChapterEndStall(ctx);
  if (stalled) return true;

  const sound = ctx.soundRef.current;
  if (!sound) {
    return flushPlanFlowAutoplayRegistration(ctx);
  }

  const st = await safeGetSoundStatus(sound);
  if (!st?.isLoaded) {
    return flushPlanFlowAutoplayRegistration(ctx);
  }
  if (st.isPlaying) return false;

  const durationMs = st.durationMillis ?? 0;
  const positionMs = st.positionMillis ?? 0;
  const atChapterEnd = isScriptureNearChapterEnd(positionMs, durationMs);

  if (atChapterEnd) {
    if (isPlanFlowChapterAdvanceInFlight() || scriptureChapterPool.shouldPreservePlaybackOnUIUnmount()) return false;
    markScriptureWantPlaying(ctx.scriptureWantPlayingRef, true);
    ctx.autoPlayScriptureRef.current = true;
    return finishScriptureChapterOnce(chapterEndFinishArgs(ctx));
  }

  if (!ctx.scriptureWantPlayingRef.current) return false;
  return tryResumeScriptureAfterInterruption(ctx);
}
