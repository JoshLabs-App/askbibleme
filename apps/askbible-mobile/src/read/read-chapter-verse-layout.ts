import { findNodeHandle, UIManager, type LayoutChangeEvent } from "react-native";
import {
  clampScrollY,
  nextScrollYFromWindowDelta,
  readVerseScrollFocusRatio,
  scrollDeltaToCenterVerseInWindow,
  scrollYToCenterVerse,
  scrollYToCenterVerseFromContentAndWindowTarget,
  readChapterReadableCenterWindowY,
  readChapterReadableCenterFromScreen,
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
  readChapterReadableCenterFromScreen,
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
  const fromNative = (event.nativeEvent as { target?: unknown }).target;
  if (typeof fromNative === "number" && fromNative > 0) return fromNative;
  const host = (event as { target?: unknown }).target ?? fromNative;
  const handle = findNodeHandle(host as Parameters<typeof findNodeHandle>[0]);
  return typeof handle === "number" && handle > 0 ? handle : null;
}

export type VerseMeasurableHost = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export function isVerseMeasurableHost(node: unknown): node is VerseMeasurableHost {
  return !!node && typeof (node as VerseMeasurableHost).measureInWindow === "function";
}

function isFiniteWindowBox(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return [x, y, width, height].every((n) => Number.isFinite(n)) && height > 0;
}

/** 整段/整屏的盒子不能当“当前高亮节”，否则会误判已经居中。 */
export function isLikelyVerseHighlightBox(height: number, viewportHeight: number): boolean {
  if (!(height > 0)) return false;
  if (viewportHeight < 1) return true;
  return height <= viewportHeight * 0.45;
}

export function measureHostInWindow(
  node: unknown,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (box: { x: number; y: number; width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(box);
    };
    const timer = setTimeout(() => finish(null), 120);
    const accept = (x: number, y: number, width: number, height: number) => {
      if (!isFiniteWindowBox(x, y, width, height)) return;
      clearTimeout(timer);
      finish({ x, y, width, height });
    };

    let attempted = false;
    if (isVerseMeasurableHost(node)) {
      attempted = true;
      try {
        node.measureInWindow(accept);
      } catch {
        /* 走 UIManager */
      }
    }
    const handle = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
    if (typeof handle === "number" && handle > 0) {
      attempted = true;
      try {
        UIManager.measureInWindow(handle, accept);
      } catch {
        /* ignore */
      }
    }
    if (!attempted) {
      clearTimeout(timer);
      finish(null);
    }
  });
}

export function measureLayoutRelativeTo(
  node: unknown,
  ancestor: unknown,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const child = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
    const parent = findNodeHandle(ancestor as Parameters<typeof findNodeHandle>[0]);
    if (typeof child !== "number" || child <= 0 || typeof parent !== "number" || parent <= 0) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (box: { x: number; y: number; width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(box);
    };
    const timer = setTimeout(() => finish(null), 120);
    try {
      UIManager.measureLayout(
        child,
        parent,
        () => {
          clearTimeout(timer);
          finish(null);
        },
        (x, y, width, height) => {
          if (!isFiniteWindowBox(x, y, width, height)) return;
          clearTimeout(timer);
          finish({ x, y, width, height });
        },
      );
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

export type ParagraphTextLine = {
  x?: number;
  y: number;
  width?: number;
  height: number;
  text?: string;
};

export type VerseCharRange = {
  verse: number;
  start: number;
  end: number;
};

export type ParagraphGroupFrame = {
  verses: number[];
  y: number;
  height: number;
};

const PARAGRAPH_BLOCK_GAP = 14;

export function verseContentLayoutFromParagraphFrames(opts: {
  verseNum: number;
  groups: ParagraphGroupFrame[];
  relative: { y: number; height: number } | null | undefined;
  originY: number;
}): { y: number; height: number } | null {
  const groups = [...opts.groups].sort((a, b) => (a.verses[0] ?? 0) - (b.verses[0] ?? 0));
  if (!groups.length) return null;
  const nativeYs = groups.map((g) => Math.round(g.y));
  const nativeDistinct = new Set(nativeYs).size > 1 || groups.length === 1;
  let acc = 0;
  for (const group of groups) {
    const contains = group.verses.includes(opts.verseNum);
    const frameY = nativeDistinct ? group.y : acc;
    if (contains) {
      const relY = opts.relative && opts.relative.height > 0 ? opts.relative.y : 0;
      const height =
        opts.relative && opts.relative.height > 0 ? opts.relative.height : group.height;
      if (!(height > 0)) return null;
      return { y: opts.originY + frameY + relY, height };
    }
    acc += group.height + PARAGRAPH_BLOCK_GAP;
  }
  return null;
}

export function displayedParagraphVerseChunk(verseNum: number, verseText: string, gap: string): string {
  return `${verseNum}${gap}${verseText} `;
}

export function paragraphVerseCharRanges(
  verses: Array<{ verse: number; text: string }>,
  gap: string,
): { fullText: string; ranges: VerseCharRange[] } {
  let fullText = "";
  const ranges: VerseCharRange[] = [];
  for (const v of verses) {
    const chunk = displayedParagraphVerseChunk(v.verse, v.text, gap);
    const start = fullText.length;
    fullText += chunk;
    ranges.push({ verse: v.verse, start, end: fullText.length });
  }
  return { fullText, ranges };
}

export function charRangesFromTextLayoutLines(
  fullText: string,
  lines: ParagraphTextLine[],
): Array<{ start: number; end: number; y: number; height: number }> {
  if (!lines.length) return [];
  const anyText = lines.some((line) => (line.text ?? "").length > 0);
  if (!anyText && fullText.length) {
    const charsPerLine = Math.max(1, Math.ceil(fullText.length / lines.length));
    let cursor = 0;
    return lines.map((line) => {
      const start = cursor;
      const end = Math.min(fullText.length, cursor + charsPerLine);
      cursor = end;
      return { start, end, y: line.y, height: line.height };
    });
  }
  const ranges: Array<{ start: number; end: number; y: number; height: number }> = [];
  let cursor = 0;
  for (const line of lines) {
    const lineText = line.text ?? "";
    if (!lineText.length) {
      ranges.push({ start: cursor, end: cursor, y: line.y, height: line.height });
      continue;
    }
    const idx = fullText.indexOf(lineText, cursor);
    if (idx >= 0) {
      ranges.push({ start: idx, end: idx + lineText.length, y: line.y, height: line.height });
      cursor = idx + lineText.length;
      continue;
    }
    const fallbackEnd = Math.min(fullText.length, cursor + lineText.length);
    ranges.push({ start: cursor, end: fallbackEnd, y: line.y, height: line.height });
    cursor = fallbackEnd;
  }
  return ranges;
}

export function verseBoxesFromParagraphTextLayout(
  verseRanges: VerseCharRange[],
  lines: ParagraphTextLine[],
  fullText: string,
): Map<number, { y: number; height: number }> {
  const lineRanges = charRangesFromTextLayoutLines(fullText, lines);
  const boxes = new Map<number, { y: number; height: number }>();
  for (const range of verseRanges) {
    const overlapping = lineRanges.filter((line) => line.end > range.start && line.start < range.end);
    if (!overlapping.length) continue;
    const first = overlapping[0];
    const last = overlapping[overlapping.length - 1];
    if (!first || !last) continue;
    const height = last.y + last.height - first.y;
    if (height <= 0) continue;
    boxes.set(range.verse, { y: first.y, height });
  }
  return fillVerseBoxesByTextProportion(verseRanges, lines, fullText, boxes);
}

export function fillVerseBoxesByTextProportion(
  verseRanges: VerseCharRange[],
  lines: ParagraphTextLine[],
  fullText: string,
  existing: Map<number, { y: number; height: number }>,
): Map<number, { y: number; height: number }> {
  if (!lines.length || !fullText.length) return existing;
  const first = lines[0];
  const last = lines[lines.length - 1];
  if (!first || !last) return existing;
  const top = first.y;
  const totalH = Math.max(first.height, last.y + last.height - first.y);
  const ys = [...existing.values()].map((box) => Math.round(box.y));
  const collapsed = existing.size > 1 && new Set(ys).size <= 1;
  const out = new Map(existing);
  for (const range of verseRanges) {
    if (!collapsed && out.has(range.verse)) continue;
    const y = top + (range.start / fullText.length) * totalH;
    const height = Math.max(first.height, ((range.end - range.start) / fullText.length) * totalH);
    out.set(range.verse, { y, height });
  }
  return out;
}

export function verseRelativeInParagraphGroup(
  verseNum: number,
  verses: number[],
  paragraphHeight: number,
  measured?: { y: number; height: number } | null,
): { y: number; height: number } | null {
  if (measured && measured.height > 8) return measured;
  if (!(paragraphHeight > 0) || !verses.length) return null;
  const index = verses.indexOf(verseNum);
  if (index < 0) return null;
  const height = Math.max(8, paragraphHeight / verses.length);
  return { y: index * height, height };
}

export type VerseCharFraction = {
  verse: number;
  start: number;
  end: number;
  total: number;
};

export function verseWindowBoxFromParagraph(opts: {
  paragraphWindow: { y: number; height: number };
  verseNum: number;
  verses: number[];
  fraction?: VerseCharFraction | null;
  measuredRelative?: { y: number; height: number } | null;
}): { y: number; height: number } | null {
  const paragraph = opts.paragraphWindow;
  if (!(paragraph.height > 0)) return null;
  const measured = opts.measuredRelative;
  const measuredUsable =
    !!measured &&
    measured.height > 8 &&
    measured.height <= paragraph.height * 0.5 &&
    measured.y >= 0 &&
    measured.y + measured.height <= paragraph.height + 12;
  if (measuredUsable && measured) {
    return { y: paragraph.y + measured.y, height: measured.height };
  }
  if (opts.fraction && opts.fraction.total > 0) {
    const y = paragraph.height * (opts.fraction.start / opts.fraction.total);
    const height = Math.max(
      24,
      paragraph.height * ((opts.fraction.end - opts.fraction.start) / opts.fraction.total),
    );
    return { y: paragraph.y + y, height };
  }
  const split = verseRelativeInParagraphGroup(opts.verseNum, opts.verses, paragraph.height, null);
  if (!split) return null;
  return { y: paragraph.y + split.y, height: split.height };
}
