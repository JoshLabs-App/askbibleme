import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export type EdgeFadeMaskProps = {
  viewportHeight: number;
  fadeTopPx?: number;
  fadeBottomPx?: number;
};

function maskStops(
  viewportHeight: number,
  fadeTopPx: number,
  fadeBottomPx: number,
) {
  const h = Math.max(viewportHeight, 1);
  const topEnd = Math.min(0.45, fadeTopPx / h);
  const topBlend = topEnd * 0.45;
  const bottomStart = Math.max(topEnd + 0.04, 1 - fadeBottomPx / h);
  const bottomBlend = bottomStart + (1 - bottomStart) * 0.55;

  return {
    colors: [
      "rgba(0,0,0,0)",
      "rgba(0,0,0,0.5)",
      "#000000",
      "#000000",
      "rgba(0,0,0,0.5)",
      "rgba(0,0,0,0)",
    ] as const,
    locations: [0, topBlend, topEnd, bottomStart, bottomBlend, 1] as const,
  };
}

/** RNCMaskedView：滚动区顶/底缘内容渐隐 */
export function EdgeFadeScrollMask({
  viewportHeight,
  fadeTopPx = 28,
  fadeBottomPx = 36,
}: EdgeFadeMaskProps) {
  const { colors, locations } = maskStops(viewportHeight, fadeTopPx, fadeBottomPx);
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...colors]}
        locations={[...locations]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export type EdgeFadeHorizontalMaskProps = {
  viewportWidth: number;
  fadeLeftPx?: number;
  fadeRightPx?: number;
};

function horizontalMaskStops(viewportWidth: number, fadeLeftPx: number, fadeRightPx: number) {
  const w = Math.max(viewportWidth, 1);
  const leftEnd = Math.min(0.45, fadeLeftPx / w);
  const leftBlend = leftEnd * 0.45;
  const rightStart = Math.max(leftEnd + 0.04, 1 - fadeRightPx / w);
  const rightBlend = rightStart + (1 - rightStart) * 0.55;

  return {
    colors: [
      "rgba(0,0,0,0)",
      "rgba(0,0,0,0.5)",
      "#000000",
      "#000000",
      "rgba(0,0,0,0.5)",
      "rgba(0,0,0,0)",
    ] as const,
    locations: [0, leftBlend, leftEnd, rightStart, rightBlend, 1] as const,
  };
}

/** RNCMaskedView：横向滚动区左/右缘内容渐隐 */
export function EdgeFadeHorizontalScrollMask({
  viewportWidth,
  fadeLeftPx = 24,
  fadeRightPx = 24,
}: EdgeFadeHorizontalMaskProps) {
  const { colors, locations } = horizontalMaskStops(viewportWidth, fadeLeftPx, fadeRightPx);
  return (
    <View style={styles.root}>
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={[...colors]}
        locations={[...locations]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
