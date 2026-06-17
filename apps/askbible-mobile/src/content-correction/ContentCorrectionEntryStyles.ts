import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

export const contentCorrectionEntryStyles = StyleSheet.create({
  linkWrap: {
    alignSelf: "center",
    marginTop: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    textDecorationLine: "underline",
    ...parchmentSans(500),
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "rgba(255, 248, 235, 0.98)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.22)",
    paddingHorizontal: 18,
    paddingTop: 16,
    maxHeight: "82%",
  },
  sheetTitle: {
    fontSize: 17,
    color: c.ink,
    ...parchmentSans(600),
    marginBottom: 6,
  },
  sheetIntro: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    marginBottom: 8,
  },
  contextHint: {
    fontSize: 12,
    lineHeight: 18,
    color: c.faint,
    marginBottom: 10,
  },
  label: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 11,
    letterSpacing: 0.35,
    color: "rgba(55, 53, 47, 0.52)",
    ...parchmentSans(600),
  },
  messageInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.26)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  counter: {
    marginTop: 4,
    textAlign: "right",
    color: "rgba(55,53,47,0.56)",
    fontSize: 11,
  },
  emailInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.26)",
    backgroundColor: "rgba(255, 248, 235, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.ink,
    fontSize: 15,
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(121, 36, 36, 0.95)",
  },
  successText: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(26, 92, 51, 0.95)",
    ...parchmentSans(500),
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.28)",
  },
  btnGhostText: {
    fontSize: 14,
    color: c.muted,
    ...parchmentSans(600),
  },
  btnPrimary: {
    backgroundColor: "rgba(255, 246, 230, 0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.35)",
  },
  btnPrimaryText: {
    fontSize: 14,
    color: c.ink,
    ...parchmentSans(600),
  },
  btnDisabled: { opacity: 0.65 },
  pressed: { opacity: 0.86 },
});

export const MAX_CONTENT_CORRECTION_MESSAGE_CHARS = 800;
