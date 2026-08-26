import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";

export const exploreGreetingNameModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    overflow: "hidden",
  },
  title: {
    fontSize: 17,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    marginBottom: 14,
  },
  input: {
    marginBottom: 14,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: "rgba(255, 177, 1, 0.22)",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnPressed: {
    opacity: 0.72,
  },
  btnTextMuted: {
    fontSize: 15,
    ...parchmentSans(500),
    color: c.muted,
  },
  btnTextPrimary: {
    fontSize: 15,
    ...parchmentSans(600),
    color: c.ink,
  },
});
