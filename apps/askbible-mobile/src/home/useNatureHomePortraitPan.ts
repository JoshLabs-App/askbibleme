import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { SHELL_VIDEO_ANIM_NATIVE_DRIVER } from "./shellVideoAnimation";
import {
  NATURE_HOME_PORTRAIT_PAN_DURATION_SEC,
  NATURE_HOME_VIDEO_LANDSCAPE_ASPECT,
} from "./nature-home-portrait-pan";
import { resolveNatureHomePortraitCoverLayout } from "./natureHomePortraitCoverLayout";

/**
 * 竖屏首页背景：自左缘起势（translateX=0），线性平移至右缘（translateX=-panDistance）后瞬间回左侧，循环。
 * 与网站 `object-position: 0% → 100%` 同向。
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
