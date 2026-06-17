import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

export const exploreBirthYearSettingsStyles = StyleSheet.create({
  title: {
    fontSize: 18,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleSpacer: {
    minWidth: 44,
  },
  topCloseBtn: {
    minWidth: 44,
    paddingVertical: 4,
    alignItems: "flex-end",
  },
  topBackBtn: {
    alignItems: "flex-start",
  },
  topCloseText: {
    fontSize: 13,
    ...parchmentSans(500),
    color: c.faint,
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  fieldLabelSpaced: {
    marginTop: 14,
  },
  pickerBlock: {
    marginTop: 8,
  },
  optionalSetText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
  },
  optionalClearBtn: {
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 4,
  },
  optionalClearText: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
  },
  nameInput: {
    ...parchmentSans(500),
  },
  actions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: c.ink,
    borderColor: c.ink,
  },
  btnDisabled: { opacity: 0.42 },
  btnPressed: { opacity: 0.85 },
  btnGhost: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
  },
  btnPrimaryText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: "#fffaf2",
    textAlign: "center",
  },
});
