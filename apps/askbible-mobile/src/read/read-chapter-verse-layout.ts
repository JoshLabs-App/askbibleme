import type { LayoutChangeEvent } from "react-native";

export type VerseLayout = { y: number; height: number };

/** 顶栏/章标题留白占视口比例 */
export const READ_VERSE_SCROLL_TOP_INSET_RATIO = 0.22;
/** 底栏 Tab + 快捷行 + 音频条留白占视口比例 */
export const READ_VERSE_SCROLL_BOTTOM_INSET_RATIO = 0.28;

export type VerseScrollFocusOpts = {
  topInsetRatio?: number;
  bottomInsetRatio?: number;
  contentHeight?: number;
};

/** 可读区垂直中心在视口中的 y 比例（用于加亮经文居中）。 */
export function readVerseScrollFocusRatio(
  opts?: Pick<VerseScrollFocusOpts, "topInsetRatio" | "bottomInsetRatio">,
): number {
  const top = opts?.topInsetRatio ?? READ_VERSE_SCROLL_TOP_INSET_RATIO;
  const bottom = opts?.bottomInsetRatio ?? READ_VERSE_SCROLL_BOTTOM_INSET_RATIO;
  return top + (1 - top - bottom) / 2;
}

export function clampScrollY(
  y: number,
  viewportHeight: number,
  contentHeight?: number,
): number {
  const maxY =
    contentHeight != null && contentHeight > viewportHeight
      ? contentHeight - viewportHeight
      : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(y, maxY));
}

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

export function scrollYToCenterVerse(
  layout: VerseLayout,
  viewportHeight: number,
  opts?: VerseScrollFocusOpts,
): number {
  const focusRatio = readVerseScrollFocusRatio(opts);
  const ideal = layout.y + layout.height / 2 - viewportHeight * focusRatio;
  return clampScrollY(ideal, viewportHeight, opts?.contentHeight);
}

export function nativeTargetFromLayoutEvent(event: LayoutChangeEvent): number | null {
  const target = (event.nativeEvent as { target?: unknown }).target;
  return typeof target === "number" ? target : null;
}
