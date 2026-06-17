import { useEffect, useRef } from "react";
import { Animated, Easing, Image, View } from "react-native";
import {
  METEOR_COUNT,
  SLEEP_MOON_SHAPE,
  STAR_COUNT,
  BREATH_RING_WRAP_HEIGHT,
  BREATH_RING_WRAP_MARGIN_BOTTOM,
  pseudoRandom01,
  visualStyles,
} from "./musicAlbumVisualShared";

export function SleepCrescentMoon({
  active,
  visible,
  centered = false,
}: {
  active: boolean;
  visible: boolean;
  centered?: boolean;
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
          duration: 7200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 7200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, phase]);

  if (!visible) return null;
  const moonOpacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.78],
  });
  return (
    <View style={[visualStyles.sleepMoonWrap, centered && visualStyles.centerVisualLandscape]} pointerEvents="none">
      <Animated.View style={{ opacity: moonOpacity }}>
        <Image source={SLEEP_MOON_SHAPE} style={visualStyles.sleepMoonImage} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}
