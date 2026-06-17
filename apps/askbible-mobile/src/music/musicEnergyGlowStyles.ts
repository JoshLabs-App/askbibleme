import { StyleSheet } from "react-native";

export const musicEnergyGlowStyles = StyleSheet.create({
  root: {
    overflow: "hidden",
    backgroundColor: "#0a0908",
  },
  orb: {
    position: "absolute",
  },
  core: {
    position: "absolute",
    backgroundColor: "rgba(251, 230, 180, 0.85)",
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
});
