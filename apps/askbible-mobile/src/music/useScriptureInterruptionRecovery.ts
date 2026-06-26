import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  isPlanFlowSessionActive,
  peekReadPlanFlowAutoplay,
  shouldLoopTodayPlanFlow,
} from "../read/read-plan-flow-autoplay";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import {
  recoverScripturePlaybackAfterBackground,
  scheduleScriptureBackgroundRecovery,
  watchScriptureChapterEndStall,
  type ScriptureBackgroundRecoveryCtx,
} from "./scriptureResumeAfterInterruption";

type Args = ScriptureBackgroundRecoveryCtx & {
  playing: boolean;
  scripturePreparing: boolean;
};

function userWantsScripturePlayback(ctx: ScriptureBackgroundRecoveryCtx): boolean {
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
      if (!userWantsScripturePlayback(ctxRef.current)) {
        return;
      }
      void watchScriptureChapterEndStall(ctxRef.current);
      if (!playing) {
        if (scriptureChapterPool.isActive()) {
          void scriptureChapterPool.retryCurrent();
        }
        void recoverScripturePlaybackAfterBackground(ctxRef.current);
      }
    };

    tick();
    const interval = setInterval(tick, intervalMs);
    return () => clearInterval(interval);
  }, [playing, scripturePreparing]);

  useEffect(() => {
    const sync = (state: AppStateStatus) => {
      if (state !== "active") return;
      if (scripturePreparing || ctxRef.current.playbackModeRef.current !== "scripture") {
        return;
      }
      scheduleScriptureBackgroundRecovery(ctxRef.current);
    };

    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, [scripturePreparing]);
}
