import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import {
  MUSIC_HOME_QUEUE_CENTER_PAD,
  MUSIC_HOME_QUEUE_ROW_HEIGHT,
  MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT,
} from "./musicHomeQueueScroll";

export const musicHomeQueuePanelStyles = StyleSheet.create({
  queueWrap: {
    width: "100%",
    maxWidth: 300,
    height: MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT,
    alignSelf: "center",
    marginBottom: 14,
    position: "relative",
  },
  queueWrapLandscape: {
    maxWidth: 340,
    height: 140,
    marginBottom: 10,
  },
  queueScroll: {
    flex: 1,
  },
  queueScrollContent: {
    // 留白要够把首尾曲目滚到视口正中，否则自动回中在两端会停在半路。
    paddingTop: MUSIC_HOME_QUEUE_CENTER_PAD,
    paddingBottom: MUSIC_HOME_QUEUE_CENTER_PAD,
  },
  queue: {
    paddingTop: 4,
  },
  queueRow: {
    minHeight: MUSIC_HOME_QUEUE_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 6,
  },
  queueDownloadIcon: {
    marginRight: 2,
  },
  queueText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.48)",
    ...parchmentSans(400),
    textAlign: "center",
  },
  queueTextActive: {
    color: "#FFFFFF",
    ...parchmentSans(600),
    fontSize: 18,
  },
  chromeHidden: {
    opacity: 0,
  },
  pressed: { opacity: 0.65 },
});
