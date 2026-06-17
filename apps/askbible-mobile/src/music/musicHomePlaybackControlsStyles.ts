import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";

export const musicHomePlaybackControlsStyles = StyleSheet.create({
  transport: {
    alignItems: "stretch",
  },
  timeLine: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.38)",
    textAlign: "center",
    marginBottom: 10,
  },
  timeSep: {
    color: "rgba(255,255,255,0.22)",
  },
  controls: {
    marginTop: 6,
    width: "100%",
    maxWidth: 292,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlsLandscape: {
    maxWidth: 280,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  timerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.72,
    position: "relative",
  },
  timerIconBtnOn: {
    opacity: 1,
  },
  timerBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 13,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  timerBadgeText: {
    fontSize: 9,
    ...parchmentSans(600),
    color: "rgba(255,255,255,0.96)",
    lineHeight: 10,
  },
  pressed: { opacity: 0.65 },
});
