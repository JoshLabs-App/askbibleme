import { useMemo } from "react";
import type { Animated } from "react-native";
import type { CoffeeBeanNodeLayout } from "./coffeeBeanNodeLayout";

/**
 * 每颗豆子的 interpolate 只依赖静态布局和它自己的时钟，所以只建一次。
 * 之前这些在渲染体里，34 颗 × 约 10 个 = 每次重渲染约 340 个新对象。
 */
export function useCoffeeBeanNodeMotion(
  node: CoffeeBeanNodeLayout,
  bobV: Animated.Value,
  orbitV: Animated.Value,
  leaderOrbitV: Animated.Value,
  pulseV: Animated.Value,
) {
  const {
    direction,
    angle,
    radius,
    beanW,
    beanH,
    orbitPhaseDeg,
    followerBaseDeg,
    beanOpacity,
    isFollower,
    reverseDark,
    pulseLiftFactor,
    pulseScaleFactor,
  } = node;

  return useMemo(
    () => ({
      angle,
      radius,
      beanW,
      beanH,
      beanOpacity,
      reverseDark,
      isFollower,
      orbitSpin: orbitV.interpolate({
        inputRange: [0, 1],
        outputRange: [`${orbitPhaseDeg}deg`, `${orbitPhaseDeg + direction * 360}deg`],
      }),
      orbitSpinFollower: leaderOrbitV.interpolate({
        inputRange: [0, 1],
        outputRange: [`${followerBaseDeg}deg`, `${followerBaseDeg + direction * 360}deg`],
      }),
      bobY: bobV.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [-14, -2, 16, 3, -14],
      }),
      danceSwayX: bobV.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [-6, 3, 8, -2, -6],
      }),
      danceFloatY: bobV.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, -3, 4, -2, 0],
      }),
      danceRotate: bobV.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: ["-16deg", "-4deg", "18deg", "6deg", "-16deg"],
      }),
      danceScale: bobV.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0.86, 0.98, 1.16, 1.02, 0.86],
      }),
      followOrbitWobble: bobV.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ["-3deg", "4deg", "-3deg"],
      }),
      followRadiusDrift: bobV.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 12, 0],
      }),
      mainOrbitWobble: bobV.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: ["-3deg", "-1deg", "4deg", "1deg", "-3deg"],
      }),
      mainRadiusDrift: bobV.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, 2, 14, 6, 0],
      }),
      // 直接给出取负后的位移，transform 里不能对 Animated 值做算术
      pulseTranslateY: pulseV.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -pulseLiftFactor],
      }),
      pulseScale: pulseV.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1 + pulseScaleFactor],
      }),
    }),
    [
      angle,
      radius,
      beanW,
      beanH,
      beanOpacity,
      reverseDark,
      isFollower,
      direction,
      orbitPhaseDeg,
      followerBaseDeg,
      pulseLiftFactor,
      pulseScaleFactor,
      bobV,
      orbitV,
      leaderOrbitV,
      pulseV,
    ],
  );
}
