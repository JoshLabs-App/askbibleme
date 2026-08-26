import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

const GOLD_SOFT = "rgba(255, 177, 1, 0.22)";

export const exploreReadingAlarmStyles = StyleSheet.create({
  hero: {
    marginTop: 18,
    alignItems: "center",
  },
  time: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 1,
    ...parchmentSans(600),
    color: c.ink,
  },
  timePressed: {
    opacity: 0.55,
  },
  timeHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    ...parchmentSans(500),
    color: c.muted,
    textAlign: "center",
  },
  pickerWrap: {
    marginTop: 8,
    alignItems: "center",
  },
  group: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.62)",
    overflow: "hidden",
  },
  row: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowPressed: {
    backgroundColor: "rgba(255, 177, 1, 0.1)",
  },
  rowLabel: {
    fontSize: 15,
    lineHeight: 22,
    ...parchmentSans(600),
    color: c.ink,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 22,
    ...parchmentSans(500),
    color: c.muted,
  },
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  segmentRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  segment: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.24)",
    backgroundColor: "rgba(255, 248, 235, 0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentSelected: {
    borderColor: "rgba(255, 177, 1, 0.85)",
    backgroundColor: GOLD_SOFT,
  },
  segmentText: {
    fontSize: 13,
    lineHeight: 18,
    ...parchmentSans(600),
    color: c.ink,
  },
});
