import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { READ_DONE_ACCENT } from "./bibleCatalogOutlineConstants";

export const bibleCatalogOutlineBookRowStyles = StyleSheet.create({
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    marginBottom: 1,
    borderRadius: 8,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    columnGap: 0,
  },
  bookRowCompact: {
    paddingVertical: 2,
    marginBottom: 0,
  },
  bookRowSelected: { backgroundColor: "rgba(118, 95, 62, 0.08)" },
  bookRowPressed: { backgroundColor: "rgba(118, 95, 62, 0.12)" },
  bookCenterCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 2,
    paddingRight: 2,
    minWidth: 0,
  },
  bookCenterCardCompact: {
    gap: 1,
    paddingLeft: 0,
    paddingRight: 0,
  },
  bookNumBadge: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  bookNumBadgeCompact: {
    width: 26,
    height: 26,
  },
  bookNumBadgeText: {
    fontSize: 16,
    lineHeight: 18,
    ...parchmentSans(600),
    letterSpacing: 0.3,
    fontVariant: ["tabular-nums"],
  },
  bookNumBadgeTextCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  bookMainBlock: {
    flex: 1,
    minWidth: 0,
  },
  bookProgressTrackRow: {
    marginTop: 4,
    paddingRight: 4,
  },
  bookTitleSummaryRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
    gap: 0,
  },
  bookNameSummaryRow: {
    flexShrink: 1,
  },
  bookRightMeta: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  bookProgressText: {
    fontSize: 15,
    lineHeight: 18,
    ...parchmentSans(400),
    color: c.muted,
    opacity: 0.92,
    fontVariant: ["tabular-nums"],
  },
  bookChapterCountText: {
    fontSize: 14,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.muted,
    opacity: 0.92,
    fontVariant: ["tabular-nums"],
  },
  bookProgressTrack: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(118, 95, 62, 0.24)",
    overflow: "hidden",
  },
  bookProgressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: READ_DONE_ACCENT,
  },
  bookProgressFillEmpty: {
    width: 0,
  },
  bookChevron: {
    marginLeft: 0,
    fontSize: 24,
    lineHeight: 24,
    color: c.faint,
    opacity: 0.58,
    ...parchmentSans(400),
  },
  bookChevronCompact: {
    fontSize: 16,
    lineHeight: 18,
    opacity: 0.45,
  },
  bookSummaryBelow: {
    width: "100%",
    paddingLeft: 1,
    fontSize: 13,
    color: c.muted,
    opacity: 0.88,
    ...parchmentSans(400),
  },
  bookNum: {
    width: 16,
    fontSize: 11,
    ...parchmentSans(600),
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  bookName: {
    flexShrink: 0,
    ...parchmentSans(600),
    letterSpacing: -0.15,
    color: c.ink,
  },
});
