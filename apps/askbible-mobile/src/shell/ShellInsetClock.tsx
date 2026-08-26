import { usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSyncExternalStore } from "react";
import {
  getHomeAutoHideChrome,
  subscribeHomeLandscapeImmersive,
} from "../home/homeLandscapeImmersive";

function formatShellInsetTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isHomePathname(pathname: string): boolean {
  if (pathname === "/" || pathname === "/index") return true;
  return /^\/?\(tabs\)\/?$/.test(pathname) || /^\/?\(tabs\)\/index\/?$/.test(pathname);
}

/** 自然首页手机横屏沉浸：底栏隐藏时在顶部居中显示壳层时间。 */
export function ShellInsetClock() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const homeAutoHideChrome = useSyncExternalStore(
    subscribeHomeLandscapeImmersive,
    getHomeAutoHideChrome,
    getHomeAutoHideChrome,
  );
  const [time, setTime] = useState(() => formatShellInsetTime(new Date()));

  /** 横屏只展示经文时顶栏居中时间；显示图标时不抢注意力。 */
  const visible = homeAutoHideChrome && isHomePathname(pathname);

  useEffect(() => {
    if (!visible) return;
    const apply = () => setTime(formatShellInsetTime(new Date()));
    apply();
    const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const kick = setTimeout(() => {
      apply();
      intervalId = setInterval(apply, 60000);
    }, msToNextMinute);
    return () => {
      clearTimeout(kick);
      if (intervalId) clearInterval(intervalId);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Text
      style={[styles.clock, { top: Math.max(insets.top, 8) + 2 }]}
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={time}
    >
      {time}
    </Text>
  );
}

const styles = StyleSheet.create({
  clock: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 14,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: 1.2,
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.92)",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
