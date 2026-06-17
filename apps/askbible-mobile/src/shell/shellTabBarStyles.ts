import { StyleSheet } from "react-native";

export const shellTabBarStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 2,
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
  playFab: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
  },
  playFabDisabled: { opacity: 0.4 },
});
