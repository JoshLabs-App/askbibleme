import { Platform, StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";

export const shellNavDrawerMenuStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(55, 53, 47, 0.52)",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  languageHint: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(55, 53, 47, 0.58)",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionDivider: {
    marginTop: 8,
    marginBottom: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(120, 53, 15, 0.18)",
  },
  row: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 2,
  },
  rowInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  localeInlineGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  localeInlineChip: {
    paddingHorizontal: 10,
    minHeight: 32,
    // 安卓窄抽屉里 flex 挤压会把「简体/繁体」裁成单字（两汉字 + 左右 padding）
    minWidth: 52,
    flexShrink: 0,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.24)",
    backgroundColor: "rgba(255, 248, 235, 0.45)",
  },
  localeInlineChipActive: {
    backgroundColor: "rgba(255, 177, 1, 0.18)",
    borderColor: "rgba(255, 177, 1, 0.75)",
  },
  localeInlineLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(55, 53, 47, 0.72)",
    ...parchmentSans(600),
    textAlign: "center",
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  localeInlineLabelActive: {
    color: "rgba(120, 75, 30, 0.95)",
  },
  rowSelected: {
    backgroundColor: "rgba(255, 248, 235, 0.42)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.18)",
  },
  rowPressed: {
    backgroundColor: "rgba(255, 244, 224, 0.72)",
  },
  rowText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#37352f",
  },
  rowTextInline: {
    flexShrink: 1,
    paddingRight: 8,
  },
  rowQuiet: {
    marginTop: 10,
    paddingVertical: 6,
  },
  rowTextQuiet: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(55, 53, 47, 0.42)",
  },
  rowDetail: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(55, 53, 47, 0.55)",
  },
  rowDetailInline: {
    marginTop: 0,
    flexShrink: 0,
    textAlign: "right",
  },
  rowDetailSelected: {
    color: "rgba(120, 95, 60, 0.85)",
    ...parchmentSans(500),
  },
  versionFooter: {
    marginTop: 8,
    paddingHorizontal: 4,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: "rgba(55, 53, 47, 0.42)",
    textAlign: "center",
  },
  holdTimeBlock: {
    marginTop: 6,
  },
  holdTimeHint: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(55, 53, 47, 0.55)",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  holdTimeChoicesWrap: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
  },
  holdTimeChoice: {
    flex: 1,
    minHeight: 32,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.18)",
    backgroundColor: "rgba(255, 248, 235, 0.52)",
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  holdTimeChoiceActive: {
    backgroundColor: "rgba(255, 177, 1, 0.18)",
    borderColor: "rgba(255, 177, 1, 0.74)",
  },
  holdTimeChoiceText: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(55, 53, 47, 0.75)",
    ...parchmentSans(600),
  },
  holdTimeChoiceTextActive: {
    color: "rgba(120, 75, 30, 0.97)",
  },
});
