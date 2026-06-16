import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMobileAppVersionLabel } from "./mobileAppVersion";

/** 全 App 顶中版本水印，便于测试截屏识别 build（Android 不展示）。 */
export function ShellVersionBadge() {
  if (Platform.OS === "android") return null;

  const insets = useSafeAreaInsets();
  const label = getMobileAppVersionLabel();

  return (
    <View
      style={[styles.wrap, { top: Math.max(insets.top, 6) + 2 }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.pill}>
        <Text style={styles.text} allowFontScaling={false}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 99,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
    fontVariant: ["tabular-nums"],
    color: "rgba(255, 255, 255, 0.94)",
  },
});
