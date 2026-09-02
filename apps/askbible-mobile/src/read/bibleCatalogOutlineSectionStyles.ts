import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { READ_NEW_TESTAMENT_ACCENT } from "@/lib/read/canon-section-theme";

export const bibleCatalogOutlineSectionStyles = StyleSheet.create({
  outline: { width: "100%", alignItems: "center" },
  outlineColumns: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
  },
  testamentHeadersRow: {
    marginBottom: 2,
  },
  testamentHeadersWithToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 0,
  },
  testamentHeaderSide: {
    flex: 1,
    alignItems: "center",
  },
  summaryToggleBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  summaryToggleBtnPressed: {
    opacity: 0.72,
  },
  summaryToggleSpacer: {
    width: 36,
    height: 36,
    marginBottom: 4,
  },
  testament: { marginTop: 4, width: "100%" },
  testamentNt: { marginTop: 0 },
  testamentColumn: {
    flex: 1,
    width: "49%",
    maxWidth: "49%",
  },
  testamentCompact: { marginTop: 2 },
  testamentBody: {
    position: "relative",
    width: "100%",
  },
  testamentHeaderWrap: {
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  testamentHeaderWrapCompact: {
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  testamentHeaderLabel: {
    fontSize: 20,
    ...parchmentSans(700),
    letterSpacing: 2.6,
    lineHeight: 26,
  },
  testamentHeaderLabelCompact: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1.2,
  },
  testamentHeaderLabelOt: { color: "#38486C" },
  testamentHeaderLabelNt: { color: READ_NEW_TESTAMENT_ACCENT },
  sectionBlock: {
    marginBottom: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 0,
  },
  sectionBlockWithFullStripe: {
    borderLeftWidth: 3,
    paddingLeft: 6,
  },
  sectionBlockWithFullStripeCompact: {
    borderLeftWidth: 2,
    paddingLeft: 5,
  },
  sectionBlockCompact: {
    marginBottom: 1,
    paddingVertical: 1,
    paddingHorizontal: 1,
  },
  sectionBlockTorahFill: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  sectionTitleRow: {
    borderLeftWidth: 4,
    paddingLeft: 8,
    marginBottom: 5,
    marginLeft: 2,
  },
  sectionTitleRowCompact: {
    borderLeftWidth: 3,
    paddingLeft: 6,
    marginBottom: 4,
    marginLeft: 1,
  },
  sectionTitleRowNoStripe: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    marginLeft: 0,
  },
  sectionTitle: {
    fontSize: 18,
    ...parchmentSans(700),
    letterSpacing: 0.6,
    lineHeight: 24,
  },
  sectionTitleCompact: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0.3,
  },
  sectionTaglinesWrap: {
    marginLeft: 14,
    marginBottom: 6,
    gap: 1,
  },
  sectionTagline: {
    fontSize: 11,
    lineHeight: 15,
    color: c.muted,
    ...parchmentSans(500),
    opacity: 0.88,
  },
});
