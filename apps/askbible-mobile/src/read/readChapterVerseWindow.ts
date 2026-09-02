/**
 * 读经章节列表窗口：只挂载视口附近条目，上下用 spacer 撑滚动高度。
 * 搜索定位 / 划重点时关闭窗口化，避免未挂载节点量不到布局。
 */

export const READ_CHAPTER_VERSE_WINDOW_OVERSCAN_PX = 1400;

export type ReadChapterWindowRange = {
  start: number;
  end: number;
  topSpacer: number;
  bottomSpacer: number;
};

export function estimateReadChapterVerseHeight(opts: {
  textLen: number;
  fontSize: number;
  lineHeight: number;
  headingCount?: number;
  hasParagraphBreak?: boolean;
  contentWidth?: number;
}): number {
  const width = Math.max(200, opts.contentWidth ?? 340);
  const charsPerLine = Math.max(8, Math.floor(width / Math.max(opts.fontSize * 0.92, 8)));
  const lines = Math.max(1, Math.ceil(Math.max(1, opts.textLen) / charsPerLine));
  const body = lines * opts.lineHeight + 18;
  const headings = (opts.headingCount ?? 0) * (opts.lineHeight + 10);
  const breakH = opts.hasParagraphBreak ? 16 : 0;
  return Math.round(body + headings + breakH);
}

export type ReadChapterVerseTops = {
  tops: number[];
  heights: number[];
  total: number;
};

/** 逐节高度前缀和：仅在条目数/高度实际变化时才需要重算，滚动本身不应触发重建。 */
export function buildReadChapterVerseTops(
  itemCount: number,
  heightAt: (index: number) => number,
): ReadChapterVerseTops {
  const count = Math.max(0, itemCount);
  const tops: number[] = new Array(count);
  const heights: number[] = new Array(count);
  let y = 0;
  for (let i = 0; i < count; i += 1) {
    tops[i] = y;
    const h = Math.max(1, heightAt(i));
    heights[i] = h;
    y += h;
  }
  return { tops, heights, total: y };
}

export function computeWindowRangeFromTops(
  built: ReadChapterVerseTops,
  opts: { scrollY: number; viewportH: number; overscanPx?: number },
): ReadChapterWindowRange {
  const { tops, heights, total } = built;
  const count = tops.length;
  if (count === 0) {
    return { start: 0, end: -1, topSpacer: 0, bottomSpacer: 0 };
  }

  const overscan = opts.overscanPx ?? READ_CHAPTER_VERSE_WINDOW_OVERSCAN_PX;
  const viewTop = Math.max(0, opts.scrollY - overscan);
  const viewBottom = opts.scrollY + Math.max(opts.viewportH, 480) + overscan;

  let start = 0;
  while (start < count - 1 && tops[start]! + heights[start]! < viewTop) {
    start += 1;
  }
  let end = start;
  while (end < count - 1 && tops[end]! < viewBottom) {
    end += 1;
  }

  const topSpacer = tops[start] ?? 0;
  const endBottom = (tops[end] ?? 0) + heights[end]!;
  const bottomSpacer = Math.max(0, total - endBottom);

  return { start, end, topSpacer, bottomSpacer };
}

export function computeReadChapterWindowRange(opts: {
  itemCount: number;
  heightAt: (index: number) => number;
  scrollY: number;
  viewportH: number;
  overscanPx?: number;
}): ReadChapterWindowRange {
  const built = buildReadChapterVerseTops(opts.itemCount, opts.heightAt);
  return computeWindowRangeFromTops(built, opts);
}
