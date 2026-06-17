import { StyleSheet } from "react-native";
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
    gap: 8,
  },
  localeInlineChip: {
    paddingHorizontal: 10,
    minHeight: 32,
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
  rowTextDestructive: {
    color: "#B42318",
  },
  rowDetail: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(55, 53, 47, 0.55)",
  },
  rowDetailSelected: {
    color: "rgba(120, 95, 60, 0.85)",
    ...parchmentSans(500),
  },
  rowDetailDestructive: {
    color: "rgba(180, 35, 24, 0.72)",
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
});
