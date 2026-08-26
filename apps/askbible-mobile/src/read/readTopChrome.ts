import type { EdgeInsets } from "react-native-safe-area-context";

/** 读经首页 / 章页顶栏共用尺寸（设置 + 搜索 + 收藏 + 字号 + 朗读） */
export const READ_TOP_CHROME = {
  topOffset: 6,
  btnSize: 44,
  iconSize: 28,
  gap: 4,
  sideInset: 8,
  iconColor: "#FFFFFF",
} as const;

/** 右上列起点（0=设置；1=搜索起共用栈） */
export function readTopChromeRightStyle(insets: Pick<EdgeInsets, "top" | "right">, index: number) {
  return {
    top:
      insets.top +
      READ_TOP_CHROME.topOffset +
      index * (READ_TOP_CHROME.btnSize + READ_TOP_CHROME.gap),
    right: Math.max(insets.right, READ_TOP_CHROME.sideInset),
  };
}

/** 左上返回（与设置同高） */
export function readTopChromeLeftStyle(insets: Pick<EdgeInsets, "top" | "left">) {
  return {
    top: insets.top + READ_TOP_CHROME.topOffset,
    left: Math.max(insets.left, READ_TOP_CHROME.sideInset),
  };
}
