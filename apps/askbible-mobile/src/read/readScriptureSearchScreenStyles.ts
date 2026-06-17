import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readTypography } from "./readTypography";

export const readScriptureSearchScreenStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  back: { alignSelf: "flex-start", marginBottom: 8 },
  backText: {
    fontSize: 14,
    ...parchmentSans(500),
    color: c.muted,
  },
  title: {
    fontSize: 22,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
    marginBottom: 12,
  },
  scopeRow: {
    flexDirection: "row",
    alignSelf: "center",
    marginBottom: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: 3,
    gap: 2,
  },
  scopeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scopeBtnOn: {
    backgroundColor: c.ink,
  },
  scopeBtnText: {
    fontSize: 13,
    ...parchmentSans(500),
    color: c.muted,
  },
  scopeBtnTextOn: {
    color: c.surface,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: c.ink,
    marginBottom: 8,
  },
  recentWrap: {
    marginTop: 2,
    marginBottom: 2,
  },
  recentTitle: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    marginBottom: 6,
  },
  recentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  recentChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 999,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recentChipText: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.ink,
  },
  hint: {
    fontSize: 12,
    color: c.faint,
    textAlign: "center",
    marginBottom: 8,
  },
  loader: { marginVertical: 20 },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
    marginVertical: 12,
  },
  empty: {
    fontSize: 14,
    lineHeight: 22,
    color: c.muted,
    textAlign: "center",
    marginTop: 24,
  },
  hit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingVertical: 10,
  },
  hitRef: {
    fontSize: 14,
    ...parchmentSans(600),
    color: readTypography.breadcrumbColor,
    marginBottom: 3,
  },
  hitText: {
    fontSize: 14,
    lineHeight: 20,
    ...parchmentSans(500),
    color: readTypography.verseColor,
  },
  hitTextHighlight: {
    color: c.parchmentAccent,
    ...parchmentSans(700),
  },
  pressed: { opacity: 0.88 },
});
