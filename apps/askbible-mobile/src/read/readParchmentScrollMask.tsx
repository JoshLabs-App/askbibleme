import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export type ReadParchmentFadePreset = "default" | "prose" | "tabbar";

type FadePresetMetrics = {
  edgeFadeTopPx: number;
  edgeFadeBottomPx: number;
  tabNearPx: number;
  topTabNearPx: number;
  tabMaskOpacity: number;
};

const PRESET_METRICS: Record<ReadParchmentFadePreset, FadePresetMetrics> = {
  /** 普通读经页/弹层：底部渐隐较轻，避免“下面透明太多” */
  default: {
    edgeFadeTopPx: 14,
    edgeFadeBottomPx: 20,
    tabNearPx: 11,
    topTabNearPx: 6,
    tabMaskOpacity: 0.02,
  },
  /** 探索长文：保留轻微顶缘，底部几乎不淡掉正文 */
  prose: {
    edgeFadeTopPx: 28,
    edgeFadeBottomPx: 18,
    tabNearPx: 14,
    topTabNearPx: 10,
    tabMaskOpacity: 0.01,
  },
  /** 主页面有底部图标/Tab 时：底部渐隐更重，贴近原有视觉 */
  tabbar: {
    edgeFadeTopPx: 70,
    edgeFadeBottomPx: 120,
    tabNearPx: 80,
    topTabNearPx: 30,
    tabMaskOpacity: 0.03,
  },
};

export function readParchmentFadeSafePadding(
  preset: ReadParchmentFadePreset,
): { top: number; bottom: number } {
  const m = PRESET_METRICS[preset];
  return {
    top: m.edgeFadeTopPx,
    bottom: m.edgeFadeBottomPx,
  };
}

function maskStops(viewportHeight: number, preset: ReadParchmentFadePreset) {
  const h = Math.max(viewportHeight, 1);
  const m = PRESET_METRICS[preset];

  const topTab = Math.min(0.4, m.topTabNearPx / h);
  const topEnd = Math.min(0.48, Math.max(topTab + 0.02, m.edgeFadeTopPx / h));
  const topBlend = topTab + (topEnd - topTab) * 0.45;

  const fadeStart = Math.max(topEnd + 0.02, 1 - m.edgeFadeBottomPx / h);
  const tabNear = Math.min(0.999, Math.max(fadeStart + 0.02, 1 - m.tabNearPx / h));
  const bottomBlend = fadeStart + (tabNear - fadeStart) * 0.45;

  return {
    colors: [
      "rgba(0,0,0,0)",
      `rgba(0,0,0,${m.tabMaskOpacity})`,
      "rgba(0,0,0,0.42)",
      "#000000",
      "#000000",
      "rgba(0,0,0,0.42)",
      `rgba(0,0,0,${m.tabMaskOpacity})`,
      "rgba(0,0,0,0)",
    ] as const,
    locations: [0, topTab, topBlend, topEnd, fadeStart, bottomBlend, tabNear, 1] as const,
  };
}

/** RNCMaskedView：顶/底缘文字渐隐（根须透明） */
export function ReadParchmentScrollMask({
  viewportHeight,
  preset = "default",
}: {
  viewportHeight: number;
  preset?: ReadParchmentFadePreset;
}) {
  const { colors, locations } = maskStops(viewportHeight, preset);
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
