import type { TextStyle } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";

export type VerseTextHighlightKind = "golden" | "bookmark" | "selection";

/** 主题库金句曾用字下色带；读经页已取消，保留空样式以免旧调用露色。 */
export function goldenVerseMarkerTextStyle(): TextStyle {
  return {};
}

/** 双击收藏：字下色带，比金句略明显 */
export function verseBookmarkMarkerTextStyle(): TextStyle {
  return verseTextHighlightStyle("bookmark");
}

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

export function verseTextHighlightStyleForVerse(opts: {
  isGolden: boolean;
  bookmarked: boolean;
}): TextStyle | undefined {
  if (opts.bookmarked) return verseTextHighlightStyle("bookmark");
  return undefined;
}
