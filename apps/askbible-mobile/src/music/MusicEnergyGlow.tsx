import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { MusicEnergyGlowOrbs } from "./MusicEnergyGlowOrbs";
import { musicEnergyGlowStyles as styles } from "./musicEnergyGlowStyles";
import { useMusicEnergyGlowBreath } from "./useMusicEnergyGlowBreath";

type Props = {
  width: number;
  height: number;
  colors: readonly [string, string, string];
  showCenterOrb?: boolean;
  centerOrbSway?: boolean;
  showSideOrbs?: boolean;
  flatGradientOnly?: boolean;
  showBottomScrim?: boolean;
  /** 呼吸动画开关：暂停 / 失焦 / 切后台时停下，避免空转。 */
  breathing?: boolean;
};

export function MusicEnergyGlow({
  width,
  height,
  colors,
  showCenterOrb = true,
  centerOrbSway = false,
  showSideOrbs = true,
  flatGradientOnly = false,
  showBottomScrim = true,
  breathing = true,
}: Props) {
  const breath = useMusicEnergyGlowBreath(breathing && !flatGradientOnly);
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
          colors={[colors[0], colors[1], colors[2]]}
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
      <MusicEnergyGlowOrbs
        width={width}
        height={height}
        colors={colors}
        breath={breath}
        orbMain={orbMain}
        orbSide={orbSide}
        core={core}
        cx={cx}
        cy={cy}
        showCenterOrb={showCenterOrb}
        centerOrbSway={centerOrbSway}
        showSideOrbs={showSideOrbs}
        showBottomScrim={showBottomScrim}
      />
    </View>
  );
}
