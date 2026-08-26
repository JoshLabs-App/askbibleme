import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
/** 依赖首页视觉偏好：Fast Refresh 改模糊档时一并刷新本戳，避免一直停在旧时间。 */
import { DEFAULT_BLUR_LEVEL } from "../home/natureHomeVisualPrefs";

void DEFAULT_BLUR_LEVEL;

/** Metro / Fast Refresh 重评本模块时更新；OTA 用 Updates.createdAt。 */
const DEV_BUILD_UPDATED_AT = new Date();
/** labels removed · refresh 01:09 */

function formatUpdatedAt(date: Date): string {
  return date
    .toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/\//g, "-");
}

function isPreviewOtaShell(): boolean {
  const channel =
    Updates.channel ||
    (Constants.expoConfig?.extra as { askbibleOtaChannel?: string } | undefined)?.askbibleOtaChannel ||
    "";
  return channel === "preview";
}

/**
 * Top-center stamp for Metro (__DEV__) and Preview OTA shells.
 * Preview 显示的是当前热更发布时间（Updates.createdAt），不是 APK 安装时间。
 * Hidden on store / production builds.
 */
export function DevBuildStamp() {
  const insets = useSafeAreaInsets();
  const preview = isPreviewOtaShell();
  if (!__DEV__ && !preview) return null;

  const stampDate =
    !__DEV__ && Updates.createdAt instanceof Date
      ? Updates.createdAt
      : DEV_BUILD_UPDATED_AT;
  // Preview：HOT = 当前跑的是频道热更时间；DEV = Metro
  const label = __DEV__ ? "DEV" : "HOT";

  return (
    <View style={[styles.container, { top: insets.top + 4 }]} pointerEvents="none">
      <Text style={styles.text}>
        {label} · {formatUpdatedAt(stampDate)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: Platform.OS === "android" ? 9999 : 0,
    alignItems: "center",
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    color: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
