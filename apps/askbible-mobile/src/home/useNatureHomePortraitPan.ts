import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { SHELL_VIDEO_ANIM_NATIVE_DRIVER } from "./shellVideoAnimation";
import {
  NATURE_HOME_PORTRAIT_PAN_DURATION_SEC,
  NATURE_HOME_VIDEO_LANDSCAPE_ASPECT,
} from "./nature-home-portrait-pan";
import { resolveNatureHomePortraitCoverLayout } from "./natureHomePortraitCoverLayout";

/**
 * @deprecated 竖屏首页已改为居中 cover 静止显示；保留供旧实验引用。
 */
export function useNatureHomePortraitPan(
  enabled: boolean,
  scaledWidth: number,
  viewportWidth: number,
  /** 换场景时从左侧重新起势 */
  sceneResetKey = "",
): Animated.Value {
  const panX = useRef(new Animated.Value(0)).current;
  const panDistance = Math.max(0, scaledWidth - viewportWidth);

  useEffect(() => {
    panX.stopAnimation();
    panX.setValue(0);
    if (!enabled || panDistance < 1) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(panX, {
          toValue: -panDistance,
          duration: NATURE_HOME_PORTRAIT_PAN_DURATION_SEC * 1000,
          easing: Easing.linear,
          useNativeDriver: SHELL_VIDEO_ANIM_NATIVE_DRIVER,
        }),
        Animated.timing(panX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: SHELL_VIDEO_ANIM_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, panDistance, panX, sceneResetKey]);

  return panX;
}

/** 竖屏 cover：按视口与片源比例估算可平移层宽度（默认横屏 16:9） */
export function natureHomePortraitScaledWidth(
  viewportWidth: number,
  viewportHeight: number,
  mediaAspect = NATURE_HOME_VIDEO_LANDSCAPE_ASPECT,
): number {
  return resolveNatureHomePortraitCoverLayout(viewportWidth, viewportHeight, mediaAspect).width;
}
