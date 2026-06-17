import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { READ_NEW_TESTAMENT_ACCENT } from "./canon-section-theme";

export const bibleCatalogOutlinePagerStyles = StyleSheet.create({
  paginatedCatalogFrame: {
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.24)",
    borderRadius: 10,
    paddingTop: 4,
    paddingHorizontal: 6,
    paddingBottom: 6,
    backgroundColor: "rgba(255, 248, 235, 0.2)",
  },
  paginatedCatalogFrameOldActive: {
    borderColor: "rgba(210, 149, 26, 0.36)",
    backgroundColor: "rgba(210, 149, 26, 0.05)",
  },
  paginatedCatalogFrameNewActive: {
    borderColor: "rgba(210, 149, 26, 0.36)",
    backgroundColor: "rgba(210, 149, 26, 0.05)",
  },
  testamentPagerWrap: {
    width: "100%",
    alignSelf: "center",
    marginBottom: 6,
  },
  testamentPager: {
    width: "100%",
    flexDirection: "row",
  },
  testamentPagerBtn: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  testamentPagerBtnActive: {
    borderBottomColor: "transparent",
  },
  testamentPagerBtnOtActive: {
    borderBottomColor: "#38486C",
    backgroundColor: "rgba(210, 149, 26, 0.12)",
  },
  testamentPagerBtnNtActive: {
    borderBottomColor: READ_NEW_TESTAMENT_ACCENT,
    backgroundColor: "rgba(210, 149, 26, 0.12)",
  },
  testamentPagerText: {
    fontSize: 18,
    lineHeight: 22,
    ...parchmentSans(700),
    color: "#38486C",
    letterSpacing: 0.8,
    opacity: 0.92,
  },
  testamentPagerTextNt: {
    color: READ_NEW_TESTAMENT_ACCENT,
  },
  testamentPagerTextActive: {
    opacity: 1,
  },
  testamentPagerTextOtActive: {
    color: "#38486C",
  },
  testamentPagerTextNtActive: {
    color: READ_NEW_TESTAMENT_ACCENT,
  },
  testamentPagerIntro: {
    marginTop: 8,
    marginBottom: 2,
    paddingLeft: 8,
    paddingRight: 4,
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    ...parchmentSans(500),
    textAlign: "left",
  },
});
