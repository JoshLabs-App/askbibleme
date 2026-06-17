import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export function useWorkSpacePlanetMotion(active: boolean) {
  const orbitA = useRef(new Animated.Value(0)).current;
  const orbitB = useRef(new Animated.Value(0)).current;
  const mistPhase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    orbitA.stopAnimation();
    orbitB.stopAnimation();
    mistPhase.stopAnimation();
    if (!active) return;
    const loopA = Animated.loop(
      Animated.timing(orbitA, {
        toValue: 1,
        duration: 72000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const loopB = Animated.loop(
      Animated.timing(orbitB, {
        toValue: 1,
        duration: 32000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const loopMist = Animated.loop(
      Animated.sequence([
        Animated.timing(mistPhase, {
          toValue: 1,
          duration: 6800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(mistPhase, {
          toValue: 0,
          duration: 6800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loopA.start();
    loopB.start();
    loopMist.start();
    return () => {
      loopA.stop();
      loopB.stop();
      loopMist.stop();
      orbitA.stopAnimation();
      orbitB.stopAnimation();
      mistPhase.stopAnimation();
    };
  }, [active, mistPhase, orbitA, orbitB]);

  const orbitADeg = orbitA.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const orbitBDeg = orbitB.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const mistOuterOpacity = mistPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.24],
  });
  const mistInnerOpacity = mistPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.26, 0.12],
  });

  return { orbitADeg, orbitBDeg, mistOuterOpacity, mistInnerOpacity };
}
