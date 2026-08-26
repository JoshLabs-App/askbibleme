import { StyleSheet } from "react-native";

export const musicHomeScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0908",
  },
  foreground: {
    flex: 1,
    zIndex: 2,
    overflow: "visible",
  },
  foregroundLandscape: {
    justifyContent: "center",
  },
  /** 与读经计划 column 同版心；横向 padding / maxWidth 由运行时与读经页共用 hook 注入 */
  panel: {
    width: "100%",
    alignSelf: "center",
    zIndex: 5,
    elevation: 5,
  },
  panelLandscape: {
    position: "absolute",
    right: 18,
    bottom: 12,
    width: "42%",
    minWidth: 280,
    maxWidth: 420,
    zIndex: 3,
    paddingHorizontal: 14,
  },
  backBtn: {
    position: "absolute",
    left: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 2,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.42)",
    textAlign: "center",
  },
  pressed: { opacity: 0.65 },
});
