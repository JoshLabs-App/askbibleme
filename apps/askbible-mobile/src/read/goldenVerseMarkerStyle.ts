import type { TextStyle } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";

export type VerseTextHighlightKind = "golden" | "bookmark";

/** 主题库金句：字下荧光笔色带（非整节块底） */
export function goldenVerseMarkerTextStyle(): TextStyle {
  return verseTextHighlightStyle("golden");
}

/** 双击收藏：字下色带，比金句略明显 */
export function verseBookmarkMarkerTextStyle(): TextStyle {
  return verseTextHighlightStyle("bookmark");
}

export function verseTextHighlightStyle(kind: VerseTextHighlightKind): TextStyle {
  if (kind === "bookmark") {
    return {
      backgroundColor: c.verseBookmarkMarker,
      borderRadius: 999,
      overflow: "hidden",
      paddingHorizontal: 5,
      paddingVertical: 1,
    };
  }
  return {
    backgroundColor: c.goldenVerseMarker,
    borderRadius: 2,
  };
}

export function verseTextHighlightStyleForVerse(opts: {
  isGolden: boolean;
  bookmarked: boolean;
}): TextStyle | undefined {
  if (opts.bookmarked) return verseTextHighlightStyle("bookmark");
  if (opts.isGolden) return verseTextHighlightStyle("golden");
  return undefined;
}
