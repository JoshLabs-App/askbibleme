import { StyleSheet } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";

export const readBibleSettingsPanelStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  sheet: {
    width: "90%",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "transparent",
    shadowColor: "#2a1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  /** 须包住各行：ParchmentModalCard 正文在内层 foreground，外层 sheet 的 gap 不生效 */
  sheetBody: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  rowAlignTop: {
    alignItems: "flex-start",
  },
  rowIcon: {
    width: 26,
    height: 34,
    marginTop: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  translationRow: {
    flexDirection: "column",
    gap: 10,
    width: "100%",
  },
  translationSelect: {
    width: "100%",
  },
  audioPlaybackRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  audioPlaybackSelect: {
    flex: 1,
  },
  audioDownloadIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  audioDownloadIconBtnPressed: {
    backgroundColor: c.hover,
  },
});
