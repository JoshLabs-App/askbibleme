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

export function SlowMeteors({
  active,
  visible,
  width,
  height,
}: {
  active: boolean;
  visible: boolean;
  width: number;
  height: number;
}) {
  const valuesRef = useRef(Array.from({ length: METEOR_COUNT }, () => new Animated.Value(0)));
  const values = valuesRef.current;

  useEffect(() => {
    values.forEach((v) => v.stopAnimation());
    if (!active) return;
    const loops = values.map((v, i) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 15000 + Math.floor(pseudoRandom01(i * 43 + 7) * 9000),
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false },
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, values]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={visualStyles.meteorLayer}>
      {values.map((v, i) => {
        const startX = width * (0.1 + pseudoRandom01(i * 3 + 1) * 0.74);
        // 只在更上方天空层运动，避免穿过中间月球主体
        const startY = height * (0.03 + pseudoRandom01(i * 5 + 2) * 0.1);
        const driftX = -(44 + pseudoRandom01(i * 11 + 3) * 30);
        const driftY = 14 + pseudoRandom01(i * 13 + 4) * 20;
        const scale = 0.72 + pseudoRandom01(i * 19 + 5) * 0.85;
        const len = 22 + pseudoRandom01(i * 23 + 6) * 22;
        const opacity = v.interpolate({
          inputRange: [0, 0.1, 0.84, 1],
          outputRange: [0, 0.26, 0.22, 0],
        });
        const tx = v.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] });
        const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] });
        return (
          <Animated.View
            key={`meteor-${i}`}
            style={[
              visualStyles.meteor,
              {
                width: len,
                left: startX,
                top: startY,
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { rotate: "-32deg" }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}
