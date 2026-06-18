export type VerseScrollFocusOpts = {
  topInsetRatio?: number;
  bottomInsetRatio?: number;
  contentHeight?: number;
};

/** 顶栏/章标题留白占视口比例 */
export const READ_VERSE_SCROLL_TOP_INSET_RATIO = 0.22;
/** 底栏 Tab + 快捷行 + 音频条留白占视口比例 */
export const READ_VERSE_SCROLL_BOTTOM_INSET_RATIO = 0.28;
/** 朗读中底栏音频条额外占视口比例 */
export const READ_VERSE_SCROLL_AUDIO_DOCK_INSET_RATIO = 0.08;

/** 与 mobile readChapterScreenConstants / shellLayout 对齐（像素） */
export const READ_CHAPTER_TOP_CHROME_PX = 6 + 44 + 1 + 44 + 12;
export const READ_CHAPTER_TAB_BAR_PX = 72;
export const READ_CHAPTER_ACTION_ROW_PX = 40 + 6;
export const READ_CHAPTER_AUDIO_DOCK_PX = 44;

export type ReadChapterScrollChromePx = {
  safeTop: number;
  safeBottom: number;
  audioDockVisible?: boolean;
};

/** 顶栏按钮 + 底栏 Tab/快捷行/音频条之间的屏幕 y 中心。 */
export function readChapterReadableCenterWindowY(
  scrollWindowY: number,
  scrollViewportHeight: number,
  chrome: ReadChapterScrollChromePx,
): number {
  const readableTop = scrollWindowY + chrome.safeTop + READ_CHAPTER_TOP_CHROME_PX;
  const bottomReserve =
    chrome.safeBottom +
    READ_CHAPTER_TAB_BAR_PX +
    READ_CHAPTER_ACTION_ROW_PX +
    (chrome.audioDockVisible ? READ_CHAPTER_AUDIO_DOCK_PX : 0);
  const readableBottom = scrollWindowY + scrollViewportHeight - bottomReserve;
  return (readableTop + readableBottom) / 2;
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
