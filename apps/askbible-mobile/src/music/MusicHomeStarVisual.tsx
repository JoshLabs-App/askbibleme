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

export function SlowStars({
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
  const valuesRef = useRef(Array.from({ length: STAR_COUNT }, () => new Animated.Value(0.35)));
  const values = valuesRef.current;

  useEffect(() => {
    values.forEach((v) => v.stopAnimation());
    if (!active) return;

    const loops = values.map((v, i) => {
      const durationA = 2600 + Math.floor(pseudoRandom01(i * 29 + 3) * 3600);
      const durationB = 2800 + Math.floor(pseudoRandom01(i * 31 + 7) * 3400);
      v.setValue(0.22 + pseudoRandom01(i * 37 + 11) * 0.56);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 0.78,
            duration: durationA,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.22,
            duration: durationB,
            easing: Easing.inOut(Easing.quad),
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
    <View pointerEvents="none" style={visualStyles.starLayer}>
      {values.map((v, i) => {
        const x = width * (0.06 + pseudoRandom01(i * 13 + 1) * 0.88);
        const y = height * (0.05 + pseudoRandom01(i * 17 + 2) * 0.5);
        const size = 1.5 + pseudoRandom01(i * 23 + 3) * 2.2;
        const trailSpan = 1.8 + pseudoRandom01(i * 29 + 5) * 4.2;
        const trailTilt = (pseudoRandom01(i * 31 + 7) - 0.5) * 0.8;
        const tx = v.interpolate({
          inputRange: [0.22, 0.5, 0.78],
          outputRange: [-trailSpan, 0, trailSpan],
        });
        const ty = v.interpolate({
          inputRange: [0.22, 0.5, 0.78],
          outputRange: [trailSpan * (0.24 + trailTilt), -trailSpan * 0.18, trailSpan * (0.24 - trailTilt)],
        });
        return (
          <Animated.View
            key={`star-${i}`}
            style={[
              visualStyles.starDot,
              {
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: size,
                opacity: v,
                transform: [{ translateX: tx }, { translateY: ty }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

