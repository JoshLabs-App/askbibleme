import { StyleSheet } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";

/** 与网站 `.read-chapter-open-book` / 左 1fr · 右 2fr 对齐 */
export const readChapterSpreadLayoutStyles = StyleSheet.create({
  openBook: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: "rgba(253, 251, 247, 0.72)",
    overflow: "hidden",
    shadowColor: "#1c1410",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  leftPage: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  spine: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    opacity: 0.55,
  },
  rightPage: {
    flex: 2,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerSpread: {
    paddingTop: 8,
    paddingBottom: 20,
    marginBottom: 8,
  },
});
