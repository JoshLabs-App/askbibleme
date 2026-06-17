import { useMemo } from "react";
import { useTrackAnalysis } from "./useTrackAnalysis";
import { sampleTrackAnalysisAt } from "./trackAnalysis";
import type { PlaybackTrack } from "./types";

export function useMusicHomeCoffeePulse(
  album: string,
  current: PlaybackTrack | undefined,
  musicCurrentSec: number,
  motionActive: boolean,
) {
  const shouldLoadTrackAnalysis = motionActive && album === "下午茶" && Boolean(current?.analysisSrc);
  const analysis = useTrackAnalysis(current?.analysisSrc ?? null, shouldLoadTrackAnalysis);

  const coffeeRhythmPulse = useMemo(() => {
    if (!analysis || !motionActive) return 0;
    const s = sampleTrackAnalysisAt(analysis, musicCurrentSec);
    const e = s.low * 0.45 + s.mid * 0.25 + s.rms * 0.3;
    return Math.max(0, Math.min(1, (e - 0.12) * 1.2));
  }, [analysis, motionActive, musicCurrentSec]);

  return { analysis, coffeeRhythmPulse };
}
