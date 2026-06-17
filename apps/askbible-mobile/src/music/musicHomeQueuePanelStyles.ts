import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import {
  MUSIC_HOME_QUEUE_FADE_BAND,
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
    paddingTop: MUSIC_HOME_QUEUE_FADE_BAND,
    paddingBottom: MUSIC_HOME_QUEUE_FADE_BAND,
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
    color: "rgba(255,255,255,0.62)",
    ...parchmentSans(400),
    textAlign: "center",
  },
  queueTextActive: {
    color: "rgba(255,255,255,0.98)",
    ...parchmentSans(500),
    fontSize: 18,
  },
  chromeHidden: {
    opacity: 0,
  },
  pressed: { opacity: 0.65 },
});
