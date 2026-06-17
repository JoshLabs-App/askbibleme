import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import {
  BREATH_RING_WRAP_HEIGHT,
  BREATH_RING_WRAP_MARGIN_BOTTOM,
  coffeeVisualCenterY,
  visualStyles,
} from "./musicAlbumVisualShared";

export function BreathingRing({
  active,
  visible,
  centered = false,
  containerHeight,
  viewportHeight,
  viewportTop = 0,
}: {
  active: boolean;
  visible: boolean;
  centered?: boolean;
  containerHeight: number;
  viewportHeight: number;
  viewportTop?: number;
}) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const inhaleMs = 7000;
    const holdMs = 1800;
    const exhaleMs = 8000;

    if (!active) {
      phase.stopAnimation();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: inhaleMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(holdMs),
        Animated.timing(phase, {
          toValue: 0,
          duration: exhaleMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(holdMs),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [active, phase]);
  const circleScale = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1.46],
  });
  const circleOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.82],
  });
  const glowOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.6],
  });
  const circleColor = "rgba(233,236,242,0.62)";
  const baseY = containerHeight - (BREATH_RING_WRAP_MARGIN_BOTTOM + BREATH_RING_WRAP_HEIGHT / 2);
  const targetY = coffeeVisualCenterY(containerHeight, centered, viewportHeight, viewportTop);
  const ringTranslateY = centered ? 0 : targetY - baseY;
  if (!visible) return null;
  return (
    <View
      style={[
        visualStyles.breathRingWrap,
        { transform: [{ translateY: ringTranslateY }] },
        centered && visualStyles.centerVisualLandscape,
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          visualStyles.breathPulseGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale: circleScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          visualStyles.breathPulseCircle,
          {
            backgroundColor: circleColor,
            opacity: circleOpacity,
            transform: [{ scale: circleScale }],
          },
        ]}
      />
    </View>
  );
}
