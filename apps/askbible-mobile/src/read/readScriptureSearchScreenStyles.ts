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
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  lead: {
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
    borderRadius: 8,
  },
  scopeBtnOn: {
    backgroundColor: c.ink,
  },
  scopeBtnText: {
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
    color: c.ink,
    marginBottom: 8,
  },
  recentWrap: {
    marginTop: 2,
    marginBottom: 2,
  },
  recentTitle: {
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
  },
  recentChipText: {
    ...parchmentSans(500),
    color: c.ink,
  },
  hint: {
    color: c.faint,
    textAlign: "center",
    marginBottom: 8,
  },
  loader: { marginVertical: 20 },
  error: {
    color: c.muted,
    textAlign: "center",
    marginVertical: 12,
  },
  empty: {
    color: c.muted,
    textAlign: "center",
    marginTop: 24,
  },
  hit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  hitRef: {
    ...parchmentSans(600),
    color: readTypography.breadcrumbColor,
    marginBottom: 3,
  },
  hitText: {
    ...parchmentSans(500),
    color: readTypography.verseColor,
  },
  hitTextHighlight: {
    color: c.ink,
    backgroundColor: c.verseBookmarkMarker,
    ...parchmentSans(700),
  },
  pressed: { opacity: 0.88 },
});
