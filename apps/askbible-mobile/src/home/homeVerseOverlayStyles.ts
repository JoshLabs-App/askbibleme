import { StyleSheet } from "react-native";

export const homeVerseOverlayStyles = StyleSheet.create({
  wrapHomeStage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
  },
  goldenSlot: {
    position: "absolute",
    alignItems: "center",
    overflow: "hidden",
  },
  goldenSlotText: {
    width: "100%",
    maxWidth: 560,
    textAlign: "center",
  },
  barStripCard: {
    maxWidth: "88%",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.30)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    overflow: "hidden",
  },
  barStripText: {
    textAlign: "center",
    maxWidth: 560,
  },
  barStripInlineCard: {
    alignSelf: "center",
  },
  cjkText: {
    letterSpacing: 0,
  },
  wrapInline: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  tapTarget: {
    alignItems: "center",
    maxWidth: "100%",
  },
  tapTargetPressed: {
    opacity: 0.88,
  },
});
