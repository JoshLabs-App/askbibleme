import { Platform, type TextStyle } from "react-native";

/** 壳层浮层图标：略压透明度，避免纯白抢眼（对齐网站 inactive text-white/60） */
export const SHELL_ICON = "rgba(255,255,255,0.72)";
export const SHELL_ICON_ACTIVE = "rgba(255,255,255,0.9)";
export const SHELL_ICON_MUTED = "rgba(255,255,255,0.58)";

/** 底部 Tab 栏：选中与未选中同一白色 */
export const SHELL_TAB_BAR_ICON = "#FFFFFF";

/** 壳层图标 / 视频上角标：与 iOS 首页一致 */
export const SHELL_ICON_TEXT_SHADOW: TextStyle = {
  textShadowColor: Platform.OS === "android" ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.55)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: Platform.OS === "android" ? 2 : 6,
};

export function shellIconTextShadow(): TextStyle {
  return SHELL_ICON_TEXT_SHADOW;
}

/** 视频背景上经文阴影（与 iOS `HomeVerseRotator` 一致） */
export function shellVideoLegibilityTextShadow(tier: "body" | "ref" | "chrome" = "body"): TextStyle {
  switch (tier) {
    case "body":
      return {
        textShadowColor: "rgba(0,0,0,0.65)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 14,
      };
    case "ref":
      return {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 10,
      };
    default:
      return SHELL_ICON_TEXT_SHADOW;
  }
}
