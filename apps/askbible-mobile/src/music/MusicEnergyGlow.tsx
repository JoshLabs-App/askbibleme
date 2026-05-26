import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { TrackAudioAnalysisV1 } from "./trackAnalysis";

/** 与放松页静湖光球同源：慢、丝滑、以大小变化为主 */
const SILK = Easing.bezier(0.42, 0, 0.58, 1);

type Props = {
  width: number;
  height: number;
  colors: readonly [string, string, string];
  analysis: TrackAudioAnalysisV1 | null;
  currentSec: number;
  playing: boolean;
  showCenterOrb?: boolean;
  centerOrbSway?: boolean;
  showSideOrbs?: boolean;
  flatGradientOnly?: boolean;
};

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

/** 全屏能量光晕：多层圆以不同节奏丝滑缩放，不跟鼓点猛跳 */
export function MusicEnergyGlow({
  width,
  height,
  colors,
  playing,
  showCenterOrb = true,
  centerOrbSway = false,
  showSideOrbs = true,
  flatGradientOnly = false,
}: Props) {
  const breathMain = useRef(new Animated.Value(0)).current;
  const breathLeft = useRef(new Animated.Value(0.32)).current;
  const breathRight = useRef(new Animated.Value(0.68)).current;

  useEffect(() => {
    // 固定慢呼吸：持续缓慢放大/缩小，不因播放状态切换而重启动画，避免“跳一下”。
    const pMain = 10.8;
    const pLeft = 13.4;
    const pRight = 9.6;

    const lMain = startBreathLoop(breathMain, pMain * 1000);
    const lLeft = startBreathLoop(breathLeft, pLeft * 1000);
    const lRight = startBreathLoop(breathRight, pRight * 1000);

    lMain.start();
    lLeft.start();
    lRight.start();
    return () => {
      lMain.stop();
      lLeft.stop();
      lRight.stop();
    };
  }, [breathMain, breathLeft, breathRight]);

  const mainScale = breathMain.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.06],
  });
  const leftScale = breathLeft.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1.03],
  });
  const rightScale = breathRight.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.04],
  });
  const coreScale = breathMain.interpolate({
    inputRange: [0, 1],
    outputRange: [0.93, 1.02],
  });
  const mainX = breathMain.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-10, 0, 10],
  });
  const mainY = breathMain.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [8, 0, -8],
  });
  const leftX = breathLeft.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [8, 0, -8],
  });
  const leftY = breathLeft.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-6, 0, 6],
  });
  const rightX = breathRight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-9, 0, 9],
  });
  const rightY = breathRight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [7, 0, -7],
  });
  const coreX = breathMain.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-4, 0, 4],
  });
  const coreXWide = breathMain.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-16, 0, 16],
  });
  const coreY = breathMain.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [4, 0, -4],
  });

  const mainOpacity = breathMain.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.16, 0.3, 0.16],
  });
  const leftOpacity = breathLeft.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.1, 0.24, 0.1],
  });
  const rightOpacity = breathRight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.11, 0.26, 0.11],
  });
  const coreOpacity = breathMain.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.06, 0.16, 0.06],
  });

  const span = Math.max(width, height);
  const orbMain = span * 0.92;
  const orbSide = span * 0.55;
  const core = span * 0.22;
  const cx = width * 0.5;
  const cy = height * 0.34;

  if (flatGradientOnly) {
    return (
      <View style={[styles.root, { width, height }]}>
        <LinearGradient
          colors={["#0a1736", "#050d1f", "#000000"]}
          locations={[0, 0.58, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { width, height }]}>
      <LinearGradient
        colors={[colors[0], colors[1], colors[2], "#0a0908"]}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            width: orbMain,
            height: orbMain,
            borderRadius: orbMain / 2,
            backgroundColor: colors[0],
            left: cx - orbMain / 2,
            top: cy - orbMain / 2,
            opacity: mainOpacity,
            transform: [{ translateX: mainX }, { translateY: mainY }, { scale: mainScale }],
          },
        ]}
      />
      {showSideOrbs ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.orb,
              {
                width: orbSide,
                height: orbSide,
                borderRadius: orbSide / 2,
                backgroundColor: colors[1],
                left: width * 0.08 - orbSide * 0.2,
                top: height * 0.18,
                opacity: leftOpacity,
                transform: [{ translateX: leftX }, { translateY: leftY }, { scale: leftScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.orb,
              {
                width: orbSide * 0.85,
                height: orbSide * 0.85,
                borderRadius: (orbSide * 0.85) / 2,
                backgroundColor: colors[2],
                right: width * 0.02 - orbSide * 0.15,
                top: height * 0.42,
                opacity: rightOpacity,
                transform: [{ translateX: rightX }, { translateY: rightY }, { scale: rightScale }],
              },
            ]}
          />
        </>
      ) : null}
      {showCenterOrb ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.core,
            {
              width: core,
              height: core,
              borderRadius: core / 2,
              left: cx - core / 2,
              top: cy - core / 2,
              opacity: coreOpacity,
              transform: [
                { translateX: centerOrbSway ? coreXWide : coreX },
                { translateY: centerOrbSway ? 0 : coreY },
                { scale: coreScale },
              ],
            },
          ]}
        />
      ) : null}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.72)"]}
        locations={[0, 0.55, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    backgroundColor: "#0a0908",
  },
  orb: {
    position: "absolute",
  },
  core: {
    position: "absolute",
    backgroundColor: "rgba(251, 230, 180, 0.85)",
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
});
