import { usePathname } from "expo-router";
import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getReadChapterBottomChromeApi,
  subscribeReadChapterBottomChromeApi,
} from "../read/read-chapter-chrome-inset";
import { readRouteUsesBottomActionChrome } from "../read/read-route-chrome";
import { ShellTabBarBottomScrim } from "./ShellTabBarBottomScrim";
import { getTabBarPortalProps, subscribeTabBarPortal } from "./shellTabBarPortalStore";
import { shouldShowParchmentTabBarScrim } from "./shellTabBarPath";
import { useShellTabBarVisible } from "./useShellTabBarVisible";

/**
 * 挂在 Tabs 布局 `tabBarHost` 内、与底栏图标同级；自屏幕底缘定位，避免被 `ShellTabBar` 内容高度裁切。
 */
export function ShellTabBarBottomScrimLayer() {
  const pathname = usePathname() ?? "";
  const insets = useSafeAreaInsets();
  const visible = useShellTabBarVisible();
  const tabProps = useSyncExternalStore(
    subscribeTabBarPortal,
    getTabBarPortalProps,
    getTabBarPortalProps,
  );
  const activeRoute = tabProps?.state.routes[tabProps.state.index]?.name;
  const chapterApi = useSyncExternalStore(
    subscribeReadChapterBottomChromeApi,
    getReadChapterBottomChromeApi,
    getReadChapterBottomChromeApi,
  );

  if (!visible) return null;
  if (!shouldShowParchmentTabBarScrim(activeRoute)) return null;

  const chapterActionChrome =
    Boolean(chapterApi) || readRouteUsesBottomActionChrome(pathname);

  return (
    <View pointerEvents="none" style={styles.host}>
      <ShellTabBarBottomScrim
        bottomInset={insets.bottom}
        chapterActionChrome={chapterActionChrome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    elevation: 0,
  },
});
