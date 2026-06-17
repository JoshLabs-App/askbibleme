import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";

export const natureHomeSettingsPanelStyles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  backdrop: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  sheet: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 7,
  },
  translationSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    width: "100%",
    paddingTop: 0,
  },
  translationIcon: {
    width: 22,
    paddingTop: 6,
    alignItems: "center",
  },
  translationBody: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowAlignTop: {
    alignItems: "flex-start",
  },
  rowIcon: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#27272a",
    borderRadius: 7,
    padding: 2,
  },
  segBtn: {
    flex: 1,
    minHeight: 30,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: "#3f3f46" },
  scaleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  scaleBtn: {
    flex: 1,
    minHeight: 30,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3f3f46",
  },
  scaleBtnDisabled: { opacity: 0.35 },
  scaleBtnDefaultOn: {
    backgroundColor: "#52525b",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#71717a",
  },
  scaleSuperText: {
    fontSize: 18,
    ...parchmentSans(700),
    color: "#f1f5f9",
    letterSpacing: 0.1,
  },
  scaleDefaultText: {
    fontSize: 15,
    lineHeight: 17,
    ...parchmentSans(600),
    color: "#f1f5f9",
    letterSpacing: 0.05,
  },
  scaleOpText: {
    fontSize: 20,
    lineHeight: 20,
    ...parchmentSans(600),
    color: "#f1f5f9",
  },
  voiceScroll: {
    width: "100%",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 6,
  },
  voiceChip: {
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    backgroundColor: "#27272a",
    paddingHorizontal: 9,
    minHeight: 30,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceChipOn: {
    backgroundColor: "#3f3f46",
    borderColor: "#71717a",
  },
  voiceAddChip: {
    minWidth: 32,
    width: 32,
    paddingHorizontal: 0,
  },
  voiceChipText: {
    fontSize: 12,
    lineHeight: 15,
    ...parchmentSans(500),
    color: "rgba(255,255,255,0.62)",
  },
  voiceChipTextOn: {
    ...parchmentSans(600),
    color: "#fff",
  },
  voiceChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voiceGenderText: {
    fontSize: 12,
    lineHeight: 14,
    ...parchmentSans(700),
    color: "rgba(255,255,255,0.55)",
  },
  voiceGenderTextOn: {
    color: "#fff",
  },
  voiceHint: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.52)",
    ...parchmentSans(500),
  },
  ttsSliderWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    width: "100%",
  },
  ttsSliderCell: {
    flex: 1,
    minWidth: 0,
  },
  ttsSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "auto",
  },
  ttsSliderIcon: {
    width: 18,
    alignItems: "center",
  },
  ttsSlider: {
    flex: 1,
    height: 30,
  },
});

export const natureHomeSettingsSegmentProps = {
  segmentStyle: natureHomeSettingsPanelStyles.segment,
  segBtnStyle: natureHomeSettingsPanelStyles.segBtn,
  segBtnOnStyle: natureHomeSettingsPanelStyles.segBtnOn,
} as const;
