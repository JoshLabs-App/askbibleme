import { useMemo } from "react";
import { Dimensions, Platform, useWindowDimensions, type ViewStyle } from "react-native";

/** 浮层底栏图标区高度（与 `ShellTabBar` 主行对齐） */
export const SHELL_TAB_BAR_CLEARANCE = 72;

/** 音乐页略高（含进度/列表留白） */
export const SHELL_TAB_BAR_CLEARANCE_MUSIC = 80;

/** 滚动内容距底：浮层 Tab + 系统手势区 */
export function shellTabBarScrollPad(safeBottom: number, extra = 0): number {
  return SHELL_TAB_BAR_CLEARANCE + safeBottom + extra;
}

/** 全屏背景槽：Android 用物理屏尺寸，iOS 用窗口尺寸 */
export function useShellFullBleedFrame() {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const screen = Dimensions.get("screen");

  return useMemo(() => {
    if (Platform.OS === "android") {
      return { width: screen.width, height: screen.height };
    }
    return { width: windowW, height: windowH };
  }, [screen.width, screen.height, windowW, windowH]);
}

export function shellFullBleedBackdropStyle(frame: {
  width: number;
  height: number;
}): ViewStyle {
  if (Platform.OS === "android") {
    return {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 0,
    };
  }
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: frame.width,
    height: frame.height,
    zIndex: 0,
  };
}

/** 隐藏系统 TabBar 占位，自定义 `ShellTabBar` 浮在场景之上 */
export const SHELL_TABS_SCREEN_OPTIONS = {
  lazy: true,
  headerShown: false,
  safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
  tabBarStyle: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 0,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderTopColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
  },
  sceneStyle: {
    backgroundColor: "transparent",
    ...(Platform.OS === "android" ? ({ overflow: "visible" } as const) : null),
  },
};
