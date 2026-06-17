import { StyleSheet } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { parchmentSans, readTypography } from "./readTypography";

export const readChapterScreenVerseStyles = StyleSheet.create({
  segmentParagraphBreak: {
    height: 16,
  },
  segmentParagraphBreakWithRule: {
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentParagraphRule: {
    width: 96,
    height: StyleSheet.hairlineWidth,
    borderRadius: 999,
    backgroundColor: c.border,
  },
  segmentHeading: {
    marginTop: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
    ...parchmentSans(600),
    color: "#70451F",
    textAlign: "center",
    letterSpacing: 0.3,
    opacity: 0.92,
  },
  verseBlock: {
    marginBottom: 14,
    textAlign: "left",
  },
  verseParagraphBlock: {
    marginBottom: 14,
  },
  verseBlockBeforeSegmentBreak: {
    marginBottom: 0,
  },
  verseInlineChunk: {
    borderRadius: 6,
  },
  verseInlineChunkSelected: {
    backgroundColor: "#FFB103",
  },
  verseInlineChunkSearchFocus: {
    backgroundColor: "#FFB103",
  },
  verseInlineChunkAudioActive: {
    backgroundColor: "#FFB103",
  },
  verseInlineChunkAudioIdle: {
    backgroundColor: "transparent",
  },
  versePrimaryLine: {
    ...parchmentSans(500),
    color: readTypography.verseColor,
  },
  verseNumAndroid: {
    includeFontPadding: false,
    textAlignVertical: "top",
    paddingTop: 0,
    marginTop: 0,
  },
  verseNum: {
    fontSize: readTypography.verseNumFontSize,
    ...parchmentSans(700),
    color: readTypography.verseNumColor,
  },
  verseNumXref: {
    color: readTypography.verseNumXrefColor,
  },
  verseNumSelected: {
    color: c.verseSearchFocusNum,
  },
  verseBlockSelected: {
    backgroundColor: "#FFB103",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verseLineActive: {
    backgroundColor: "#FFB103",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verseLineIdle: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  verseLineSearchFocus: {
    backgroundColor: "#FFB103",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFB103",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verseNumActive: { color: c.verseAudioActiveNum },
  verseNumSearchFocus: { color: c.verseSearchFocusNum },
  verseContrast: {
    marginTop: 7,
    color: c.muted,
    ...parchmentSans(400),
  },
  scriptureEndingSection: {
    marginTop: 0,
    marginBottom: 30,
  },
  scriptureClosingDivider: {
    marginTop: 0,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    alignSelf: "center",
  },
  scriptureShadowGradient: {
    width: "100%",
    height: 28,
  },
  scriptureClosingRuleRow: {
    width: "100%",
    maxWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scriptureClosingRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(143, 104, 62, 0.44)",
  },
  scriptureClosingDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "rgba(143, 104, 62, 0.6)",
  },
  chapterDoneRow: {
    marginTop: 50,
    marginBottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chapterDoneWrap: {
    alignSelf: "center",
    alignItems: "center",
  },
  chapterDoneText: {
    fontSize: 20,
    color: "#6E835E",
    ...parchmentSans(600),
  },
  endNav: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 80,
    marginBottom: 50,
    paddingTop: 0,
    gap: 8,
  },
  endSide: { flex: 1, minWidth: 0 },
  endSideRight: { alignItems: "flex-end" },
  endLink: {
    fontSize: 13,
    ...parchmentSans(500),
    color: readTypography.breadcrumbColor,
  },
  endLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  endLinkRowRight: {
    justifyContent: "flex-end",
  },
  endCenter: { flexShrink: 0, maxWidth: 120, paddingHorizontal: 4 },
  endCenterText: {
    fontSize: 16,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  pressed: { opacity: 0.88 },
});
