import { LinearGradient } from "expo-linear-gradient";
import { Animated, StyleSheet, View } from "react-native";
import { musicEnergyGlowStyles as styles } from "./musicEnergyGlowStyles";
import type { MusicEnergyGlowBreath } from "./useMusicEnergyGlowBreath";

type Props = {
  width: number;
  height: number;
  colors: readonly [string, string, string];
  breath: MusicEnergyGlowBreath;
  orbMain: number;
  orbSide: number;
  core: number;
  cx: number;
  cy: number;
  showCenterOrb: boolean;
  centerOrbSway: boolean;
  showSideOrbs: boolean;
  showBottomScrim: boolean;
};

export function MusicEnergyGlowOrbs({
  width,
  height,
  colors,
  breath,
  orbMain,
  orbSide,
  core,
  cx,
  cy,
  showCenterOrb,
  centerOrbSway,
  showSideOrbs,
  showBottomScrim,
}: Props) {
  return (
    <>
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
            opacity: breath.mainOpacity,
            transform: [{ translateX: breath.mainX }, { translateY: breath.mainY }, { scale: breath.mainScale }],
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
                opacity: breath.leftOpacity,
                transform: [{ translateX: breath.leftX }, { translateY: breath.leftY }, { scale: breath.leftScale }],
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
                opacity: breath.rightOpacity,
                transform: [{ translateX: breath.rightX }, { translateY: breath.rightY }, { scale: breath.rightScale }],
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
              opacity: breath.coreOpacity,
              transform: [
                { translateX: centerOrbSway ? breath.coreXWide : breath.coreX },
                { translateY: centerOrbSway ? 0 : breath.coreY },
                { scale: breath.coreScale },
              ],
            },
          ]}
        />
      ) : null}
      {showBottomScrim ? (
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.72)"]}
          locations={[0, 0.55, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />
      ) : null}
    </>
  );
}
