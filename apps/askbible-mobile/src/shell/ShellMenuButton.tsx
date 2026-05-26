import { usePathname } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { useSyncExternalStore } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getHomeAutoHideChrome,
  getHomeLandscapeImmersive,
  subscribeHomeLandscapeImmersive,
} from "../home/homeLandscapeImmersive";
import {
  getMusicAutoHideChrome,
  subscribeMusicAutoHideChrome,
} from "../music/musicAutoHideChrome";
import { t } from "../i18n/site-copy";
import { useShellNavMenu } from "./ShellNavMenuContext";
import { isShellPrimaryTabPathname } from "./shellPrimaryRoute";
import { trackTap } from "../telemetry/tap";
import { SHELL_ICON } from "./shellChromeIcons";
import { ShellMaterialIcon } from "./ShellMaterialIcon";

function isHomePathname(pathname: string): boolean {
  if (pathname === "/" || pathname === "/index") return true;
  return /^\/?\(tabs\)\/?$/.test(pathname) || /^\/?\(tabs\)\/index\/?$/.test(pathname);
}

function isMusicPathname(pathname: string): boolean {
  return pathname === "/music" || /^\/?\(tabs\)\/music\/?$/.test(pathname);
}

type Props = {
  /** 深色背景用白图标；浅色羊皮卷同样用白字+阴影（与底栏一致） */
  tone?: "onDark" | "onLight";
};

/** 左上角三杠：与网站 `AppShellTopBar` 菜单钮同位 */
export function ShellMenuButton({ tone = "onDark" }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { open, toggleMenu } = useShellNavMenu();
  const homeLandscapeImmersive = useSyncExternalStore(
    subscribeHomeLandscapeImmersive,
    getHomeLandscapeImmersive,
    getHomeLandscapeImmersive,
  );
  const homeAutoHideChrome = useSyncExternalStore(
    subscribeHomeLandscapeImmersive,
    getHomeAutoHideChrome,
    getHomeAutoHideChrome,
  );
  const musicAutoHideChrome = useSyncExternalStore(
    subscribeMusicAutoHideChrome,
    getMusicAutoHideChrome,
    getMusicAutoHideChrome,
  );

  if (isHomePathname(pathname) && (homeLandscapeImmersive || homeAutoHideChrome)) return null;
  if (isMusicPathname(pathname) && musicAutoHideChrome) return null;
  if (!isShellPrimaryTabPathname(pathname)) return null;

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
        tone === "onLight" && styles.btnOnLight,
      ]}
      accessibilityRole="button"
      accessibilityLabel={open ? t("chrome.closeNavMenu") : t("nav.drawerUserMenuTitle")}
      accessibilityState={{ expanded: open }}
    >
      <ShellMaterialIcon name="menu" size={26} color={SHELL_ICON} />
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
  btnOnLight: {},
});
