import type { TextStyle } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";

export type VerseTextHighlightKind = "golden" | "bookmark" | "selection";


export function verseTextHighlightStyle(kind: VerseTextHighlightKind): TextStyle {
  if (kind === "golden") return {};
  if (kind === "bookmark") {
    return {
      backgroundColor: c.verseBookmarkMarker,
      borderRadius: 2,
      paddingHorizontal: 2,
      paddingVertical: 1,
    };
  }
  if (kind === "selection") {
    return {
      backgroundColor: c.verseSelectionMarker,
      borderRadius: 2,
      paddingHorizontal: 2,
      paddingVertical: 1,
    };
  }
  return {};
}
