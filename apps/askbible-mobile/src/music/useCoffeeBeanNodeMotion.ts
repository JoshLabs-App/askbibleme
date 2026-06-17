import type { Animated } from "react-native";
import type { CoffeeBeanNodeLayout } from "./coffeeBeanNodeLayout";

export function useCoffeeBeanNodeMotion(
  node: CoffeeBeanNodeLayout,
  bobV: Animated.Value,
  orbitV: Animated.Value,
  leaderOrbitV: Animated.Value,
  rhythmPulse: number,
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

  const orbitSpin = orbitV.interpolate({
    inputRange: [0, 1],
    outputRange: [`${orbitPhaseDeg}deg`, `${orbitPhaseDeg + direction * 360}deg`],
  });
  const orbitSpinFollower = leaderOrbitV.interpolate({
    inputRange: [0, 1],
    outputRange: [`${followerBaseDeg}deg`, `${followerBaseDeg + direction * 360}deg`],
  });
  const bobY = bobV.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-14, -2, 16, 3, -14],
  });
  const danceSwayX = bobV.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-6, 3, 8, -2, -6],
  });
  const danceFloatY = bobV.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -3, 4, -2, 0],
  });
  const danceRotate = bobV.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["-16deg", "-4deg", "18deg", "6deg", "-16deg"],
  });
  const danceScale = bobV.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.86, 0.98, 1.16, 1.02, 0.86],
  });
  const followOrbitWobble = bobV.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-3deg", "4deg", "-3deg"],
  });
  const followRadiusDrift = bobV.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 12, 0],
  });
  const mainOrbitWobble = bobV.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["-3deg", "-1deg", "4deg", "1deg", "-3deg"],
  });
  const mainRadiusDrift = bobV.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 2, 14, 6, 0],
  });
  const pulseLift = rhythmPulse * pulseLiftFactor;
  const pulseScale = 1 + rhythmPulse * pulseScaleFactor;

  return {
    angle,
    radius,
    beanW,
    beanH,
    beanOpacity,
    reverseDark,
    isFollower,
    orbitSpin,
    orbitSpinFollower,
    bobY,
    danceSwayX,
    danceFloatY,
    danceRotate,
    danceScale,
    followOrbitWobble,
    followRadiusDrift,
    mainOrbitWobble,
    mainRadiusDrift,
    pulseLift,
    pulseScale,
  };
}
