import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useTrackAnalysis } from "./useTrackAnalysis";
import { sampleTrackAnalysisAt } from "./trackAnalysis";
import {
  getMusicPlaybackProgressTickSnapshot,
  subscribeMusicPlaybackProgressTick,
} from "./musicPlaybackProgressTick";

/**
 * 节拍脉冲走 Animated.Value，不走 React state。
 *
 * 播放位置每 250～400ms 更新一次；如果脉冲是 state，34 颗豆子每次都要重渲染，
 * 每颗还要重建约 10 个 interpolate。改成 setValue 之后一次重渲染都没有。
 */
export function useMusicHomeCoffeePulse(analysisSrc: string | null, motionActive: boolean) {
  const pulseV = useRef(new Animated.Value(0)).current;
  const analysis = useTrackAnalysis(analysisSrc, motionActive && Boolean(analysisSrc));

  useEffect(() => {
    if (!analysis || !motionActive) {
      pulseV.setValue(0);
      return;
    }
    const apply = () => {
      const s = sampleTrackAnalysisAt(analysis, getMusicPlaybackProgressTickSnapshot().musicCurrentSec);
      const e = s.low * 0.45 + s.mid * 0.25 + s.rms * 0.3;
      pulseV.setValue(Math.max(0, Math.min(1, (e - 0.12) * 1.2)));
    };
    apply();
    return subscribeMusicPlaybackProgressTick(apply);
  }, [analysis, motionActive, pulseV]);

  return pulseV;
}
