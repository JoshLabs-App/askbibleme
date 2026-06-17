import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import {
  BREATH_RING_WRAP_HEIGHT,
  BREATH_RING_WRAP_MARGIN_BOTTOM,
  COFFEE_CUP_ICON_SIZE,
  coffeeVisualCenterY,
  visualStyles,
} from "./musicAlbumVisualShared";

export function SunOrb({
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
    if (!active) {
      phase.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, phase]);

  const cupGlowOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.34],
  });
  const baseY = containerHeight - (BREATH_RING_WRAP_MARGIN_BOTTOM + BREATH_RING_WRAP_HEIGHT / 2);
  const targetY = coffeeVisualCenterY(containerHeight, centered, viewportHeight, viewportTop);
  const coffeeTranslateY = centered ? 0 : targetY - baseY;
  if (!visible) return null;
  return (
    <View
      style={[
        visualStyles.coffeeWrap,
        { transform: [{ translateY: coffeeTranslateY }] },
        centered && visualStyles.centerVisualLandscape,
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          visualStyles.coffeeGlow,
          {
            opacity: cupGlowOpacity,
          },
        ]}
      />
      <MaterialIcons
        name="local-cafe"
        size={COFFEE_CUP_ICON_SIZE}
        color="#fff7ef"
        style={visualStyles.coffeeCupIcon}
      />
    </View>
  );
}
