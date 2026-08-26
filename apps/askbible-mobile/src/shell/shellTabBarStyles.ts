import { Platform, StyleSheet } from "react-native";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { SHELL_TAB_BAR_DOCK_GAP } from "./shellPlaybackTransportLayout";

export const shellTabBarStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    // Android：透明底栏 + elevation 会绘制成实心黑条，压住全屏视频
    elevation: Platform.OS === "android" ? 0 : 2,
    alignItems: "center",
    // 水平内边距只加在 Tab 行；播放坞自带 shellPlaybackDockChrome.paddingHorizontal，避免叠加上跳位
    paddingHorizontal: 0,
    gap: SHELL_TAB_BAR_DOCK_GAP,
    backgroundColor: "transparent",
  },
  /** 裁切全屏羊皮底图，只露出坞 + Tab 区（与读经栈同一 JPG） */
  scriptureDockParchmentHost: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: c.canvas,
  },
  row: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    maxWidth: 400,
    width: "100%",
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  side: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    minWidth: 0,
  },
  sideLeft: {
    justifyContent: "space-between",
  },
  sideRight: {
    justifyContent: "space-between",
  },
  tabBtn: {
    flex: 1,
    width: undefined,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnPressed: { opacity: 0.8 },
  scriptureFab: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
    borderRadius: 30,
    backgroundColor: "transparent",
  },
  scriptureFabPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
