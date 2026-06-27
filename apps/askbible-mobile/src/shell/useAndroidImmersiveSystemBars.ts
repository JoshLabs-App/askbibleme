import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";
import { Platform } from "react-native";

/** Android 全屏 Tab：浅色手势条（沉浸式导航栏由 MainActivity 控制） */
export function useAndroidImmersiveSystemBars(enabled = true) {
  useEffect(() => {
    if (Platform.OS !== "android" || !enabled) return;
    void NavigationBar.setButtonStyleAsync("light").catch(() => {});
  }, [enabled]);
}
