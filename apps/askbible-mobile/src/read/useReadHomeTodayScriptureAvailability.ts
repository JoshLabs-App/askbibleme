import { useEffect } from "react";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import { buildPlanChapterQueue } from "./read-plan-flow-nav";
import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";

type Args = {
  enabled: boolean;
  homeMode: boolean;
  payload: TodayReadingPlanPayload | null;
  translationId: string;
  onReadyChange: (ready: boolean) => void;
};

/** 读经首页：今日读经是否支持壳层播放钮。 */
export function useReadHomeTodayScriptureAvailability({
  enabled,
  homeMode,
  payload,
  translationId,
  onReadyChange,
}: Args) {
  useEffect(() => {
    if (!enabled || !homeMode) {
      onReadyChange(false);
      return;
    }
    const readings = payload?.day?.readings ?? [];
    const queue = readings.length ? buildPlanChapterQueue(readings) : [];
    const ready =
      queue.length > 0 && Boolean(translationId) && translationSupportsChapterAudio(translationId);
    onReadyChange(ready);
  }, [enabled, homeMode, onReadyChange, payload, translationId]);
}
