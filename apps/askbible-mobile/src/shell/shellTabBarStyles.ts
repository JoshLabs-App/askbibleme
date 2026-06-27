import { Platform, StyleSheet } from "react-native";

export const shellTabBarStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    // Android：透明底栏 + elevation 会渲染成实心黑条，压住全屏视频
    elevation: Platform.OS === "android" ? 0 : 2,
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: "transparent",
  },
  row: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    maxWidth: 400,
    width: "100%",
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  side: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  sideLeft: {
    justifyContent: "flex-end",
    paddingRight: 6,
  },
  sideRight: {
    justifyContent: "flex-start",
    paddingLeft: 6,
  },
  tabBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnPressed: { opacity: 0.8 },
  scriptureFabShell: {
    width: 60,
    height: 60,
    marginHorizontal: 8,
  },
  scriptureFab: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
    borderRadius: 30,
  },
  scriptureFabIdle: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  scriptureFabActive: {
    backgroundColor: "rgba(255, 177, 1, 0.16)",
  },
  scriptureFabDisabled: {
    opacity: 0.35,
  },
  scriptureFabPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
