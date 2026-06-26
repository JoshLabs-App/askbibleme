import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { isPlanFlowSessionActive } from "./read-plan-flow-autoplay";
import { flushTodayPlanScriptureResume } from "./flushTodayPlanScriptureResume";

const FLUSH_INTERVAL_MS = 4000;

type Args = {
  playing: boolean;
  playbackMode: "music" | "scripture";
  scriptureDurationSec: number;
};

/** 今日 planFlow 经文：定期与切后台时持久化播放位置。 */
export function useTodayPlanScriptureResumePersistence({
  playing,
  playbackMode,
  scriptureDurationSec,
}: Args): void {
  const durationRef = useRef(scriptureDurationSec);
  durationRef.current = scriptureDurationSec;

  useEffect(() => {
    const shouldTrack = () =>
      playbackMode === "scripture" &&
      (scriptureChapterPool.isActive() || isPlanFlowSessionActive());

    const flush = () => {
      if (!shouldTrack()) return;
      void flushTodayPlanScriptureResume({ durationSec: durationRef.current });
    };

    if (!playing || !shouldTrack()) return;

    flush();
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, playbackMode]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") return;
      void flushTodayPlanScriptureResume({ durationSec: durationRef.current });
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);
}
