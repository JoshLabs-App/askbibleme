import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { postReadingTheme as pr } from "./postReadingTheme";

const BOOK_RADIUS = 12;

export const readChapterPostReadingEditionsStyles = StyleSheet.create({
  section: {
    marginTop: 32,
    width: "100%",
    alignItems: "center",
  },
  sectionSpread: {
    marginTop: 0,
    alignItems: "stretch",
  },
  heading: { marginBottom: 20, alignItems: "center", width: "100%" },
  headingSpread: {
    marginBottom: 14,
    alignItems: "flex-start",
  },
  headingText: {
    fontSize: 22,
    ...parchmentSans(600),
    letterSpacing: 0.8,
    lineHeight: 30,
    color: pr.heading,
    textAlign: "center",
    marginBottom: 10,
  },
  headingTextSpread: {
    textAlign: "left",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  headingLead: {
    ...parchmentSans(400),
    color: "rgba(120, 75, 30, 0.9)",
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 18,
  },
  headingTapHint: {
    ...parchmentSans(500),
    color: "rgba(140, 90, 42, 0.92)",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  headingRule: {
    maxWidth: 224,
    width: "56%",
    alignSelf: "center",
  },
  headingRuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: pr.headingRule },
  spreadParts: {
    width: "100%",
    gap: 18,
  },
  spreadSection: {
    width: "100%",
  },
  spreadSectionLabel: {
    fontSize: 13,
    ...parchmentSans(600),
    letterSpacing: 0.35,
    color: "rgba(120, 75, 30, 0.88)",
    marginBottom: 6,
  },
  bookSpread: {
    width: "100%",
    borderRadius: BOOK_RADIUS,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    overflow: "hidden",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  bookInner: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    minHeight: 1,
    position: "relative",
  },
  pagePressable: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
  },
  pagePressableLeft: {},
  pagePressableRight: {},
  pagePressed: { opacity: 0.92 },
  page: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "transparent",
    overflow: "hidden",
    position: "relative",
  },
  pageLeft: {
    borderTopLeftRadius: BOOK_RADIUS,
    borderBottomLeftRadius: BOOK_RADIUS,
  },
  pageRight: {
    borderTopRightRadius: BOOK_RADIUS,
    borderBottomRightRadius: BOOK_RADIUS,
  },
  pageDiscoverLeft: { backgroundColor: "transparent" },
  pageDiscoverRight: { backgroundColor: "transparent" },
  pageConsultLeft: { backgroundColor: "transparent" },
  pageConsultRight: { backgroundColor: "transparent" },
  pageDiscoverActiveLeft: {
    backgroundColor: "transparent",
  },
  pageDiscoverActiveRight: {
    backgroundColor: "transparent",
  },
  pageConsultActiveLeft: {
    backgroundColor: "transparent",
  },
  pageConsultActiveRight: {
    backgroundColor: "transparent",
  },
  pageArt: {
    width: "100%",
    aspectRatio: 1,
    flexShrink: 0,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  pageArtImage: {
    width: "100%",
    height: "100%",
    opacity: 0.8,
  },
  pageBody: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 4,
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 7,
    backgroundColor: "transparent",
  },
  pageTitle: {
    fontSize: 17,
    ...parchmentSans(600),
    letterSpacing: 0.6,
    lineHeight: 24,
    textAlign: "center",
    color: "#A56A2D",
  },
  pageBlurb: {
    fontSize: 11,
    lineHeight: 17,
    color: "rgba(120, 75, 30, 0.86)",
    textAlign: "center",
    maxWidth: 168,
  },
  pageActionRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 18,
  },
  pageActionText: {
    ...parchmentSans(500),
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(140, 90, 42, 0.92)",
    letterSpacing: 0.2,
  },
  bottomActionRow: {
    marginTop: 50,
    marginBottom: 50,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  bottomActionSide: {
    flex: 1,
    minWidth: 0,
  },
  bottomActionSideRight: {
    alignItems: "flex-end",
  },
  bottomNavBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  bottomNavInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  bottomNavText: {
    ...parchmentSans(500),
    fontSize: 13,
    color: "rgba(140, 90, 42, 0.88)",
    letterSpacing: 0.1,
  },
  backToTopOuter: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backToTopOuterText: {
    ...parchmentSans(500),
    color: "rgba(140, 90, 42, 0.84)",
    letterSpacing: 0.2,
  },
});
