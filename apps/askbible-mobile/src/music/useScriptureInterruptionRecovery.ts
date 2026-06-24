import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
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

/** 系统音频打断 / 锁屏章末 / 章末 stall：自动续播或 planFlow 续下一章（用户主动暂停除外）。 */
export function useScriptureInterruptionRecovery({
  playing,
  scripturePreparing,
  ...ctx
}: Args): void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    if (scripturePreparing || ctxRef.current.playbackModeRef.current !== "scripture") {
      return;
    }

    const wantActive =
      ctxRef.current.scriptureWantPlayingRef.current ||
      ctxRef.current.autoPlayScriptureRef.current;
    const intervalMs = playing ? 1500 : wantActive ? 800 : 2000;

    const tick = () => {
      void watchScriptureChapterEndStall(ctxRef.current);
      if (!playing) {
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
