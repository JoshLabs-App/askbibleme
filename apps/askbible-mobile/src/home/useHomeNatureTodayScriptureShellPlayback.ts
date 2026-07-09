import { useMemo } from "react";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { useReadBibleTypography } from "../read/ReadBibleTypographyContext";
import { getLocalReadingPlanRegistry } from "../read/reading-plan/fetch-reading-plan-registry";
import { useReadHomeTodayScriptureAvailability } from "../read/useReadHomeTodayScriptureAvailability";
import { useTodayReadingPlan } from "../read/useTodayReadingPlan";

/** 自然首页：今日读经是否可用作壳层播放钮（与读经首页共用 ready 状态）。 */
export function useHomeNatureTodayScriptureShellPlayback(homeFocused: boolean, enabled = true) {
  const { setReadHomeTodayScriptureReady } = useMusicPlayback();
  const { primaryTranslationId } = useReadBibleTypography();
  const registryPlans = useMemo(() => getLocalReadingPlanRegistry().plans, []);
  const todayPlan = useTodayReadingPlan(registryPlans, { enabled: enabled && homeFocused });

  useReadHomeTodayScriptureAvailability({
    enabled: enabled && homeFocused,
    homeMode: true,
    payload: todayPlan.payload,
    translationId: primaryTranslationId,
    onReadyChange: setReadHomeTodayScriptureReady,
  });
}
