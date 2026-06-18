import type { LayoutChangeEvent } from "react-native";
import {
  clampScrollY,
  nextScrollYFromWindowDelta,
  readVerseScrollFocusRatio,
  scrollDeltaToCenterVerseInWindow,
  scrollYToCenterVerse,
  scrollYToCenterVerseFromContentAndWindowTarget,
  readChapterReadableCenterWindowY,
  type VerseLayout,
  type VerseScrollFocusOpts,
  readChapterAudioScrollFocusOpts,
  READ_VERSE_SCROLL_BOTTOM_INSET_RATIO,
  READ_VERSE_SCROLL_TOP_INSET_RATIO,
} from "../../../../lib/read/read-chapter-verse-scroll-focus";

export type { VerseLayout, VerseScrollFocusOpts };
export {
  clampScrollY,
  nextScrollYFromWindowDelta,
  readVerseScrollFocusRatio,
  scrollDeltaToCenterVerseInWindow,
  scrollYToCenterVerse,
  scrollYToCenterVerseFromContentAndWindowTarget,
  readChapterReadableCenterWindowY,
  readChapterAudioScrollFocusOpts,
  READ_VERSE_SCROLL_BOTTOM_INSET_RATIO,
  READ_VERSE_SCROLL_TOP_INSET_RATIO,
};

/** 将 measureInWindow 结果换算为 ScrollView 内容坐标系中的 y。 */
export function verseContentYFromWindow(
  verseWindowY: number,
  scrollViewportWindowY: number,
  scrollOffsetY: number,
): number {
  return scrollOffsetY + (verseWindowY - scrollViewportWindowY);
}

export function isVerseVisibleInScrollViewport(
  layout: VerseLayout,
  scrollOffsetY: number,
  viewportHeight: number,
  opts?: VerseScrollFocusOpts,
): boolean {
  if (viewportHeight <= 0) return true;
  const topMargin = viewportHeight * (opts?.topInsetRatio ?? READ_VERSE_SCROLL_TOP_INSET_RATIO);
  const bottomMargin =
    viewportHeight * (opts?.bottomInsetRatio ?? READ_VERSE_SCROLL_BOTTOM_INSET_RATIO);
  const visibleTop = scrollOffsetY + topMargin;
  const visibleBottom = scrollOffsetY + viewportHeight - bottomMargin;
  const verseTop = layout.y;
  const verseBottom = layout.y + layout.height;
  return verseTop >= visibleTop && verseBottom <= visibleBottom;
}

export function nativeTargetFromLayoutEvent(event: LayoutChangeEvent): number | null {
  const target = (event.nativeEvent as { target?: unknown }).target;
  return typeof target === "number" ? target : null;
}
