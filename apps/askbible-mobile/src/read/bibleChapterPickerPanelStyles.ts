import { Platform, StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";

export const CHAPTER_CELL_W = 52;
export const CHAPTER_CELL_H = 44;
export const CHAPTER_GRID_GAP = 8;
export const CHAPTER_GRID_PAD_TOP = 14;
export const CHAPTER_SHEET_PAD = 16;
export const CHAPTER_BACKDROP_PAD = 20;
export const CHAPTER_HEADER_H = 48;

export const bibleChapterPickerModalFrameStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    justifyContent: "center",
    paddingHorizontal: CHAPTER_BACKDROP_PAD,
  },
  sheet: {
    width: "100%",
    maxHeight: "70%",
    minHeight: 160,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    ...(Platform.OS === "android" ? { elevation: 8 } : null),
  },
  sheetBody: {
    width: "100%",
    height: "100%",
  },
});

export const bibleChapterPickerPanelStyles = StyleSheet.create({
  embeddedRoot: {
    width: "100%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: CHAPTER_HEADER_H,
  },
  headerSideSpacer: { width: 30, height: 30 },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 249, 239, 0.72)",
  },
  backBtnPressed: {
    backgroundColor: "rgba(118, 95, 62, 0.12)",
  },
  title: {
    flex: 1,
    fontSize: 17,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  closeMark: {
    fontSize: 28,
    lineHeight: 28,
    color: c.faint,
    paddingHorizontal: 4,
  },
  modalSheetOuter: {
    width: "100%",
    height: "100%",
    alignSelf: "stretch",
  },
  modalSheetRoot: {
    width: "100%",
    height: "100%",
    alignSelf: "stretch",
  },
  modalSheetBg: {
    padding: CHAPTER_SHEET_PAD,
    backgroundColor: "transparent",
  },
  modalSheetBgFill: {
    flex: 1,
  },
  modalSheetBgImage: {
    borderRadius: 14,
    opacity: 0.92,
  },
  chapterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CHAPTER_GRID_GAP,
    paddingTop: CHAPTER_GRID_PAD_TOP,
    justifyContent: "center",
  },
  chapterCell: {
    width: CHAPTER_CELL_W,
    height: CHAPTER_CELL_H,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 250, 242, 0.58)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.chapterCellBorder,
  },
  chapterCellPressed: {
    backgroundColor: "rgba(255, 246, 234, 0.74)",
    borderColor: c.borderStrong,
  },
  chapterCellText: { fontSize: 15, ...parchmentSans(600), color: c.ink },
});
