import { StyleSheet } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";

export const readCatalogScreenStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  homeTopStack: {
    gap: 0,
  },
  hero: { alignItems: "center", paddingHorizontal: 4, paddingTop: 0 },
  titleZh: {
    marginTop: 2,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  homeVerseCard: {
    marginTop: 4,
    paddingHorizontal: 22,
    minHeight: 70,
    maxHeight: 70,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 0,
  },
  homeVerseText: {
    fontSize: 14,
    lineHeight: 21,
    color: c.muted,
    textAlign: "center",
    ...parchmentSans(500),
  },
  homeVerseRef: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.3,
    ...parchmentSans(500),
  },
  bottomVerseWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 100,
    marginBottom: 8,
  },
  catalogLoader: { marginTop: 16, alignSelf: "center" },
  todayCard: { marginTop: 12, paddingVertical: 4 },
  todayPlanName: {
    fontSize: 16,
    ...parchmentSans(500),
    color: c.ink,
    textAlign: "center",
  },
  todayEmpty: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: c.muted,
    textAlign: "center",
  },
  catalogSection: {
    marginTop: 8,
    width: "100%",
    alignItems: "center",
    paddingTop: 4,
  },
  catalogInner: {
    width: "100%",
  },
  catalogBlock: {
    width: "100%",
  },
  topActions: {
    position: "absolute",
    zIndex: 50,
    gap: 4,
    alignItems: "center",
  },
  topActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  topActionPressed: {
    opacity: 0.68,
  },
  topActionIcon: {
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  pressed: { opacity: 0.88 },
});
