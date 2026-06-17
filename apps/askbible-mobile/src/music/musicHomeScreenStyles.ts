import { StyleSheet } from "react-native";

export const musicHomeScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0908",
  },
  foreground: {
    flex: 1,
    zIndex: 2,
  },
  foregroundLandscape: {
    justifyContent: "center",
  },
  panel: {
    paddingHorizontal: 32,
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
