import { useMemo } from "react";

export type HomeNatureVideoPowerPolicy = {
  /** 用静帧替代循环视频，降低解码与发热 */
  preferPosterStage: boolean;
  /** 场景切换是否交叉淡入（false = 瞬时切，避免双路解码） */
  crossfadeAnimated: boolean;
  /** 跳过相邻场景视频预载，减少 IO 与内存峰值 */
  skipAdjacentPreload: boolean;
};

type Args = {
  /** 用户点「模糊」关 / 开循环视频：关模糊 = 开视频 */
  liveVideoEnabled: boolean;
  /** @deprecated 保留参数兼容；低电量不再覆盖用户开视频选择 */
  batteryPowerSaving?: boolean;
};

/**
 * 默认播循环视频；用户点模糊才切静帧。
 * 低电量不再强制盖掉用户选择——否则 Android 省电模式常开时「关模糊」永远只剩柔焦图。
 */
export function useHomeNatureVideoPowerPolicy({
  liveVideoEnabled,
}: Args): HomeNatureVideoPowerPolicy {
  return useMemo(() => {
    const preferPosterStage = !liveVideoEnabled;
    return {
      preferPosterStage,
      crossfadeAnimated: !preferPosterStage,
      skipAdjacentPreload: preferPosterStage,
    };
  }, [liveVideoEnabled]);
}
