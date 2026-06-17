import { useMemo } from "react";
import { isNatureSoftFocusBlurEnabled, type NatureSoftFocusPrefs } from "./natureHomePrefs";

export type HomeNatureVideoPowerPolicy = {
  /** 用静帧替代循环视频，降低解码与发热 */
  preferPosterStage: boolean;
  /** 场景切换是否交叉淡入（false = 瞬时切，避免双路解码） */
  crossfadeAnimated: boolean;
  /** 跳过相邻场景视频预载，减少 IO 与内存峰值 */
  skipAdjacentPreload: boolean;
};

type Args = {
  softFocus: NatureSoftFocusPrefs;
};

/** 首页背景视频：柔焦开时用静帧；低电量策略待 dev client 重编后接 expo-battery。 */
export function useHomeNatureVideoPowerPolicy({ softFocus }: Args): HomeNatureVideoPowerPolicy {
  return useMemo(() => {
    const softFocusStaticBackground = isNatureSoftFocusBlurEnabled(softFocus);
    return {
      preferPosterStage: softFocusStaticBackground,
      crossfadeAnimated: true,
      skipAdjacentPreload: softFocusStaticBackground,
    };
  }, [softFocus]);
}
