import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

/** 与读经首页 `READ_PARCHMENT_PAGE_TOP_HOME` 同量级，略留标题呼吸感 */
export const EXPLORE_PAGE_TOP_PAD = 40;

/** 数算年日页中间经文区不透明度（30% 透明） */
export const YEAR_DAY_COUNT_SCRIPTURE_TEXT_OPACITY = 0.7;

/** 与读经/祷告羊皮卷页对齐 */
export const exploreStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  scroll: {
    paddingHorizontal: 22,
    maxWidth: 448,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 26,
    ...parchmentSans(600),
    letterSpacing: -0.3,
    lineHeight: 35,
    color: c.ink,
    textAlign: "center",
  },
  rule: {
    marginTop: 18,
    height: StyleSheet.hairlineWidth,
    width: 48,
    backgroundColor: c.border,
    alignSelf: "center",
  },
  lead: {
    marginTop: 18,
    fontSize: 15,
    ...parchmentSans(500),
    lineHeight: 24,
    color: c.muted,
    textAlign: "center",
  },
  section: {
    marginTop: 36,
    paddingTop: 8,
  },
  sectionDivider: {
    marginTop: 18,
    marginBottom: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    opacity: 0.8,
  },
  sectionCaption: {
    fontSize: 12,
    ...parchmentSans(600),
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  backLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  yearDayCountBackLink: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  backLinkText: {
    fontSize: 14,
    ...parchmentSans(500),
    color: c.muted,
  },
  yearDayCountTitle: {
    fontSize: 22,
    ...parchmentSans(600),
    letterSpacing: -0.3,
    lineHeight: 28,
    color: c.ink,
    textAlign: "center",
    marginTop: 8,
  },
  yearDayCountRule: {
    marginTop: 8,
    height: StyleSheet.hairlineWidth,
    width: 32,
    backgroundColor: c.border,
    alignSelf: "center",
  },
  yearDayCountLeadBlock: {
    marginTop: 10,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  yearDayCountLeadVerse: {
    width: "100%",
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(500),
    letterSpacing: 0.05,
    color: c.inkSoft,
    textAlign: "center",
  },
  yearDayCountLeadLine: {
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.inkSoft,
  },
  yearDayCountLeadRef: {
    fontSize: 10,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.faint,
    letterSpacing: 0.1,
  },
  yearDayCountLeadPressed: { opacity: 0.72 },
  yearDayCountScriptureWrap: {
    opacity: YEAR_DAY_COUNT_SCRIPTURE_TEXT_OPACITY,
  },
  yearDayCountTimelineSection: {
    marginTop: 14,
    marginBottom: 0,
  },
  yearDayCountBottomContext: {
    marginTop: 18,
    gap: 14,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  yearDayCountBottomParagraph: {
    width: "100%",
    maxWidth: 380,
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
  },
  yearDayCountBottomRef: {
    fontSize: 10,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.faint,
    letterSpacing: 0.1,
  },
  yearDayCountBottomRefLine: {
    marginTop: -6,
    width: "100%",
    maxWidth: 380,
    fontSize: 10,
    lineHeight: 16,
    ...parchmentSans(500),
    color: c.faint,
    letterSpacing: 0.1,
    textAlign: "right",
  },
  iconGrid: {
    marginTop: 16,
    paddingTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
  },
  iconTile: {
    alignItems: "center",
    gap: 10,
  },
  iconTilePressed: { opacity: 0.88 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.55)",
  },
  iconLabel: {
    width: "100%",
    fontSize: 12,
    lineHeight: 15,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
});
