import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import {
  COFFEE_BEAN_COUNT,
  FOLLOW_WHITE_COFFEE_BEAN_INDICES,
  WHITE_COFFEE_BEAN_INDEX,
  pseudoRandom01,
} from "./musicAlbumVisualConstants";

export function useCoffeeBeanOrbitMotion(active: boolean) {
  const orbitValuesRef = useRef(
    Array.from({ length: COFFEE_BEAN_COUNT }, () => new Animated.Value(0)),
  ).current;
  const bobValuesRef = useRef(
    Array.from({ length: COFFEE_BEAN_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    orbitValuesRef.forEach((v) => v.stopAnimation());
    bobValuesRef.forEach((v) => v.stopAnimation());
    if (!active) return;

    const orbitLoops = orbitValuesRef.map((v, i) => {
      const isLeader = i === WHITE_COFFEE_BEAN_INDEX;
      const isFollower = FOLLOW_WHITE_COFFEE_BEAN_INDICES.includes(
        i as (typeof FOLLOW_WHITE_COFFEE_BEAN_INDICES)[number],
      );
      const baseDuration = isLeader ? 24500 : isFollower ? 27200 : 29400;
      const jitter = Math.floor(pseudoRandom01(i * 31 + 7) * 9000);
      return Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: baseDuration + jitter,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        { resetBeforeIteration: false },
      );
    });

    const bobLoops = bobValuesRef.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(120 + Math.floor(pseudoRandom01(i * 53 + 11) * 1200)),
          Animated.timing(v, {
            toValue: 1,
            duration: 5200 + Math.floor(pseudoRandom01(i * 43 + 5) * 2800),
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 5200 + Math.floor(pseudoRandom01(i * 47 + 3) * 2800),
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false },
      ),
    );
    orbitLoops.forEach((l) => l.start());
    bobLoops.forEach((l) => l.start());
    return () => {
      orbitLoops.forEach((l) => l.stop());
      bobLoops.forEach((l) => l.stop());
      orbitValuesRef.forEach((v) => v.stopAnimation());
      bobValuesRef.forEach((v) => v.stopAnimation());
    };
  }, [active, bobValuesRef, orbitValuesRef]);

  return { orbitValuesRef, bobValuesRef };
}
