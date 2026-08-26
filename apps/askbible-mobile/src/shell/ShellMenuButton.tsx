import { usePathname } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { useSyncExternalStore } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getHomeAutoHideChrome,
  subscribeHomeLandscapeImmersive,
} from "../home/homeLandscapeImmersive";
import { t } from "../i18n/site-copy";
import { useShellNavMenu } from "./ShellNavMenuContext";
import { isHomeNatureRoute } from "./shellPrimaryRoute";
import { trackTap } from "../telemetry/tap";
import { ShellMaterialIcon } from "./ShellMaterialIcon";

/** 左上角三杠：仅自然首页显示；横屏「只看经文」时隐藏，显示图标时可操作。 */
export function ShellMenuButton() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { open, toggleMenu } = useShellNavMenu();
  const homeAutoHideChrome = useSyncExternalStore(
    subscribeHomeLandscapeImmersive,
    getHomeAutoHideChrome,
    getHomeAutoHideChrome,
  );

  if (!isHomeNatureRoute(pathname)) return null;
  if (homeAutoHideChrome) return null;

  return (
    <Pressable
      onPress={() => {
        trackTap("shell.menu");
        toggleMenu();
      }}
      style={[
        styles.btn,
        {
          top: insets.top + 6,
          left: Math.max(insets.left, 8),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={open ? t("chrome.closeNavMenu") : t("nav.drawerUserMenuTitle")}
      accessibilityState={{ expanded: open }}
    >
      <ShellMaterialIcon name="menu" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    zIndex: 110,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
});
