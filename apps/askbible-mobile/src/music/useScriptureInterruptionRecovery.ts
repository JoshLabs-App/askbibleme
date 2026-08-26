import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, type AppStateStatus } from "react-native";
import { getShellAudioInterrupted } from "../audio/shellAudioInterruption";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
import {
  isPlanFlowSessionActive,
  peekReadPlanFlowAutoplay,
  shouldLoopTodayPlanFlow,
} from "../read/read-plan-flow-autoplay";
import {
  scheduleScriptureBackgroundRecovery,
  watchScriptureChapterEndStall,
  type ScriptureBackgroundRecoveryCtx,
} from "./scriptureResumeAfterInterruption";
import { isScriptureUserPauseHeld } from "./scriptureUserPause";

type Args = ScriptureBackgroundRecoveryCtx & {
  playing: boolean;
  scripturePreparing: boolean;
};

function userWantsScripturePlayback(ctx: ScriptureBackgroundRecoveryCtx): boolean {
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

/** 系统音频打断 / 锁屏章末 / 章末 stall：自动续播或 planFlow 续下一章（用户主动暂停除外）。 */
export function useScriptureInterruptionRecovery({
  playing,
  scripturePreparing,
  ...ctx
}: Args): void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    // 原生读经：禁后台轮询（避免 CPU 杀进程）。
    if (isNativeMainTrackOs() && getShellScriptureWantPlaying()) return;

    const planFlowKick =
      isPlanFlowSessionActive() &&
      shouldLoopTodayPlanFlow() &&
      userWantsScripturePlayback(ctxRef.current);

    if (scripturePreparing) {
      return;
    }
    if (ctxRef.current.playbackModeRef.current !== "scripture" && !planFlowKick) {
      return;
    }

    const wantActive = userWantsScripturePlayback(ctxRef.current) || planFlowKick;
    const intervalMs = playing ? 1500 : wantActive ? 800 : 2000;

    const tick = () => {
      if (getShellAudioInterrupted()) return;
      if (isNativeMainTrackOs() && getShellScriptureWantPlaying()) return;
      if (isScriptureUserPauseHeld()) return;
      if (!userWantsScripturePlayback(ctxRef.current)) {
        return;
      }
      if (ctxRef.current.scripturePlayInFlightRef.current) return;
      void watchScriptureChapterEndStall(ctxRef.current);
      if (!playing) {
        // 只排一次恢复：禁止 playing 闪一下就 playAt 重开整章（安卓跳闪主因）。
        scheduleScriptureBackgroundRecovery(ctxRef.current);
      }
    };

    const interval = setInterval(tick, intervalMs);
    return () => clearInterval(interval);
  }, [playing, scripturePreparing]);

  useEffect(() => {
    const sync = (state: AppStateStatus) => {
      if (getShellAudioInterrupted()) return;
      if (isNativeMainTrackOs()) {
        // 原生读经：只在回前台时兜底；后台交给原生播放器。
        // 即使 wantPlaying 仍为 true 也要跑：安卓关屏后队列耗尽时 JS 可能没续上，回前台应补播。
        if (state !== "active") return;
      } else if (state !== "active" && state !== "inactive" && state !== "background") {
        return;
      }
      if (scripturePreparing || ctxRef.current.playbackModeRef.current !== "scripture") {
        return;
      }
      if (!userWantsScripturePlayback(ctxRef.current)) return;
      scheduleScriptureBackgroundRecovery(ctxRef.current);
    };

    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, [scripturePreparing]);

  useEffect(() => {
    const onBegan = () => {
      const sound = ctxRef.current.soundRef.current;
      if (!sound) return;
      void sound.pauseAsync().catch(() => {});
    };
    const sub = DeviceEventEmitter.addListener("AudioSessionInterruptionBegan", onBegan);
    return () => sub.remove();
  }, []);
}
