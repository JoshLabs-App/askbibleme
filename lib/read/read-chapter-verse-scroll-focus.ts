export type VerseScrollFocusOpts = {
  topInsetRatio?: number;
  bottomInsetRatio?: number;
  contentHeight?: number;
};

/** 顶栏/章标题留白占视口比例 */
export const READ_VERSE_SCROLL_TOP_INSET_RATIO = 0.18;
/** 底栏 Tab + 快捷行 + 音频条留白占视口比例 */
export const READ_VERSE_SCROLL_BOTTOM_INSET_RATIO = 0.18;
/** 朗读中底栏音频条额外占视口比例 */
export const READ_VERSE_SCROLL_AUDIO_DOCK_INSET_RATIO = 0.08;

export type ReadChapterScrollChromePx = {
  safeTop: number;
  safeBottom: number;
  audioDockVisible?: boolean;
};

/** 读经时经节应对齐的可读区中心。底部空间会计入音频条留白。 */
export function readChapterReadableCenterWindowY(
  scrollWindowY: number,
  scrollViewportHeight: number,
  chrome: ReadChapterScrollChromePx,
): number {
  const top = READ_VERSE_SCROLL_TOP_INSET_RATIO;
  const bottom =
    READ_VERSE_SCROLL_BOTTOM_INSET_RATIO +
    (chrome.audioDockVisible ? READ_VERSE_SCROLL_AUDIO_DOCK_INSET_RATIO : 0);
  return scrollWindowY + scrollViewportHeight * (top + (1 - top - bottom) / 2);
}

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

export type VerseLayout = { y: number; height: number };

export function scrollYToCenterVerse(
  layout: VerseLayout,
  viewportHeight: number,
  opts?: VerseScrollFocusOpts,
): number {
  const focusRatio = readVerseScrollFocusRatio(opts);
  const ideal = layout.y + layout.height / 2 - viewportHeight * focusRatio;
  return clampScrollY(ideal, viewportHeight, opts?.contentHeight);
}

/** 屏幕坐标：经节中心相对可读区中心的偏移（正值 = 经节偏下，应增大 scrollY）。 */
export function scrollDeltaToCenterVerseInWindow(opts: {
  verseWindowY: number;
  verseHeight: number;
  scrollWindowY: number;
  scrollViewportHeight: number;
  topInsetRatio?: number;
  bottomInsetRatio?: number;
  chrome?: ReadChapterScrollChromePx;
}): number {
  const verseCenterWindow = opts.verseWindowY + opts.verseHeight / 2;
  const targetCenterWindow =
    opts.chrome != null
      ? readChapterReadableCenterWindowY(
          opts.scrollWindowY,
          opts.scrollViewportHeight,
          opts.chrome,
        )
      : opts.scrollWindowY +
        opts.scrollViewportHeight *
          readVerseScrollFocusRatio(opts);
  return verseCenterWindow - targetCenterWindow;
}

export function nextScrollYFromWindowDelta(
  currentScrollY: number,
  delta: number,
  viewportHeight: number,
  contentHeight?: number,
): number {
  return clampScrollY(currentScrollY + delta, viewportHeight, contentHeight);
}

/** 由 content y + 屏幕目标中心直接算 scrollY，不依赖 scrollOffsetRef。 */
export function scrollYToCenterVerseFromContentAndWindowTarget(opts: {
  verseContentY: number;
  verseHeight: number;
  scrollWindowY: number;
  targetCenterWindow: number;
  viewportHeight: number;
  contentHeight?: number;
}): number {
  const ideal =
    opts.verseContentY +
    opts.verseHeight / 2 -
    (opts.targetCenterWindow - opts.scrollWindowY);
  return clampScrollY(ideal, opts.viewportHeight, opts.contentHeight);
}

export function readChapterAudioScrollFocusOpts(
  audioDockVisible = false,
): Pick<VerseScrollFocusOpts, "topInsetRatio" | "bottomInsetRatio"> {
  return {
    topInsetRatio: READ_VERSE_SCROLL_TOP_INSET_RATIO,
    bottomInsetRatio:
      READ_VERSE_SCROLL_BOTTOM_INSET_RATIO +
      (audioDockVisible ? READ_VERSE_SCROLL_AUDIO_DOCK_INSET_RATIO : 0),
  };
}
