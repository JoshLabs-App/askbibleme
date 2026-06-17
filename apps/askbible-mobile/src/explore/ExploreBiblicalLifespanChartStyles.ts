import { Platform, StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { LOGO_TEXT_ACCENT_COLOR as LOGO_COLOR } from "../shell/logo-colors";

export const ERA_COL_W = 58;
const IS_ANDROID = Platform.OS === "android";

export const biblicalLifespanChartStyles = StyleSheet.create({
  section: {
    marginTop: 20,
    paddingTop: 4,
  },
  heading: {
    fontSize: 15,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  headingAfterModern: {
    marginTop: 8,
  },
  scaleHint: {
    marginTop: 6,
    fontSize: 11,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
  },
  chart: {
    marginTop: 18,
  },
  modernSection: {
    marginTop: 10,
  },
  modernChart: {
    marginTop: 0,
  },
  ntSection: {
    marginTop: 2,
  },
  mainSection: {
    marginTop: 4,
  },
  sectionDivider: {
    marginTop: 10,
    marginBottom: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderStrong,
  },
  groupDivider: {
    marginTop: 8,
    marginBottom: 8,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderStrong,
  },
  ntScaleHint: {
    fontSize: 11,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  ntDisciplesHeadingRow: {
    marginTop: 2,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  ntChartCompact: {
    marginTop: 8,
  },
  eraColSpacer: {
    width: ERA_COL_W,
  },
  ntMinorHeading: {
    fontSize: 11,
    ...parchmentSans(600),
    color: c.faint,
    textAlign: "left",
    letterSpacing: 0.1,
  },
  entry: {},
  entryGap: {
    marginBottom: IS_ANDROID ? 6 : 8,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  eraCol: {
    width: ERA_COL_W,
    paddingRight: 8,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: c.borderStrong,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  eraColContinued: {
    borderRightColor: c.border,
  },
  eraLabel: {
    fontSize: 10,
    lineHeight: IS_ANDROID ? 12 : 14,
    ...parchmentSans(500),
    color: c.muted,
    textAlign: "right",
    includeFontPadding: false,
  },
  bodyCol: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 8,
    rowGap: IS_ANDROID ? 0 : 2,
  },
  metaPressed: { opacity: 0.72 },
  name: {
    fontSize: 14,
    lineHeight: IS_ANDROID ? 16 : 18,
    ...parchmentSans(600),
    color: c.ink,
    includeFontPadding: false,
  },
  lifespan: {
    fontSize: 13,
    lineHeight: IS_ANDROID ? 15 : 17,
    ...parchmentSans(600),
    color: LOGO_COLOR,
    includeFontPadding: false,
  },
  ref: {
    fontSize: 12,
    lineHeight: IS_ANDROID ? 14 : 16,
    ...parchmentSans(500),
    color: c.faint,
    flexShrink: 1,
    includeFontPadding: false,
  },
  modernName: {
    fontSize: 15,
  },
  modernDisplayName: {
    fontSize: 21,
  },
  modernLifespan: {
    fontSize: 14,
  },
  modernRef: {
    fontSize: 13,
  },
  barTrack: {
    marginTop: IS_ANDROID ? 4 : 6,
    height: 6,
    width: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(120, 53, 15, 0.12)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: LOGO_COLOR,
    minWidth: 3,
  },
});
