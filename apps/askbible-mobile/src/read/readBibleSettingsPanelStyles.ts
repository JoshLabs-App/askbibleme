import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
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
    backgroundColor: c.surfaceSolid,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
    shadowColor: "#2a1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  rowIcon: {
    width: 22,
    paddingTop: 8,
    alignItems: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  translationRow: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  translationSelect: {
    width: "100%",
  },
  audioPlaybackRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  sizeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sizeActionsTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  sizeSection: {
    gap: 8,
  },
  segmentModeText: {
    fontSize: 12,
    color: c.muted,
    ...parchmentSans(700),
  },
  segmentModeTextActive: {
    color: c.parchmentAccent,
  },
  sizeActionBtn: {
    width: 36,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  sizeActionBtnPressed: {
    backgroundColor: c.hover,
  },
  sizeActionBtnDisabled: {
    opacity: 0.48,
  },
  sizeActionBtnActive: {
    backgroundColor: c.parchmentAccentGlow,
    borderColor: c.parchmentAccent,
  },
  sizeActionText: {
    fontSize: 13,
    color: c.ink,
    ...parchmentSans(600),
  },
  sizeActionTextPreset: {
    fontSize: 14,
    letterSpacing: 0.3,
    color: c.ink,
    ...parchmentSans(700),
  },
  sizeActionTextDisabled: {
    color: c.muted,
  },
});
