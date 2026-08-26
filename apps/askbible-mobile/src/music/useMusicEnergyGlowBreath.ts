import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";

const SILK = Easing.bezier(0.42, 0, 0.58, 1);

function startBreathLoop(value: Animated.Value, periodMs: number): Animated.CompositeAnimation {
  const half = Math.max(2400, Math.floor(periodMs / 2));
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: half,
        easing: SILK,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: half,
        easing: SILK,
        useNativeDriver: true,
      }),
    ]),
  );
}

/** active=false 时不起循环：睡眠专辑只画平铺渐变，光球根本不渲染，跑动画是纯浪费。 */
export function useMusicEnergyGlowBreath(active: boolean) {
  const breathMain = useRef(new Animated.Value(0)).current;
  const breathLeft = useRef(new Animated.Value(0.32)).current;
  const breathRight = useRef(new Animated.Value(0.68)).current;

  useEffect(() => {
    if (!active) return;
    const lMain = startBreathLoop(breathMain, 10.8 * 1000);
    const lLeft = startBreathLoop(breathLeft, 13.4 * 1000);
    const lRight = startBreathLoop(breathRight, 9.6 * 1000);
    lMain.start();
    lLeft.start();
    lRight.start();
    return () => {
      lMain.stop();
      lLeft.stop();
      lRight.stop();
    };
  }, [active, breathMain, breathLeft, breathRight]);

  return useMemo(() => ({
    mainScale: breathMain.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.06] }),
    leftScale: breathLeft.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.03] }),
    rightScale: breathRight.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.04] }),
    coreScale: breathMain.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.02] }),
    mainX: breathMain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-10, 0, 10] }),
    mainY: breathMain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [8, 0, -8] }),
    leftX: breathLeft.interpolate({ inputRange: [0, 0.5, 1], outputRange: [8, 0, -8] }),
    leftY: breathLeft.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-6, 0, 6] }),
    rightX: breathRight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-9, 0, 9] }),
    rightY: breathRight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [7, 0, -7] }),
    coreX: breathMain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-4, 0, 4] }),
    coreXWide: breathMain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-16, 0, 16] }),
    coreY: breathMain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [4, 0, -4] }),
    mainOpacity: breathMain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.16, 0.3, 0.16] }),
    leftOpacity: breathLeft.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.24, 0.1] }),
    rightOpacity: breathRight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.11, 0.26, 0.11] }),
    coreOpacity: breathMain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.16, 0.06] }),
  }), [breathMain, breathLeft, breathRight]);
}

export type MusicEnergyGlowBreath = ReturnType<typeof useMusicEnergyGlowBreath>;
