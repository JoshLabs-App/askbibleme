import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  findNodeHandle,
  InteractionManager,
  UIManager,
  type LayoutChangeEvent,
  type ScrollView,
  type View,
} from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { parseScriptureVerseParam } from "../bible/parse-scripture-verse-param";
import type { LoadedChapter } from "../bible/types";
import { READ_CHAPTER_SCROLL_TOP_PAD } from "./readChapterScreenConstants";
import {
  nativeTargetFromLayoutEvent,
  nextScrollYFromWindowDelta,
  scrollDeltaToCenterVerseInWindow,
  scrollYToCenterVerse,
  readChapterAudioScrollFocusOpts,
  measureHostInWindow,
  measureLayoutRelativeTo,
  verseContentLayoutFromParagraphFrames,
  verseRelativeInParagraphGroup,
  verseWindowBoxFromParagraph,
  type VerseCharFraction,
  type VerseLayout,
} from "./read-chapter-verse-layout";
import { publishReadChapterScrollWindow } from "./readChapterScrollWindowStore";

const SEARCH_FOCUS_MS = 14_000;
/** 进章侧滑结束后再滚；布局未就绪时多试几次 */
const SEARCH_SCROLL_RETRY_DELAYS_MS = [0, 120, 320, 640] as const;

export function useReadChapterSearchFocus(
  chapterData: LoadedChapter | null,
  verseParam: string | string[] | undefined,
  scrollRef: React.RefObject<ScrollView | null>,
  scrollContentHeightRef?: React.RefObject<number>,
  scrollContentAnchorRef?: React.RefObject<View | null>,
  safeAreaInsets?: Pick<EdgeInsets, "top" | "bottom">,
  scrollHeaderHeightRef?: React.RefObject<number>,
) {
  const [searchFocusVerse, setSearchFocusVerse] = useState<number | null>(null);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [verseLayoutTick, setVerseLayoutTick] = useState(0);
  const verseLayoutsRef = useRef<Map<number, VerseLayout>>(new Map());
  const verseNativeTargetsRef = useRef<Map<number, number>>(new Map());
  const verseHostsRef = useRef<Map<number, unknown>>(new Map());
  const paragraphHostsRef = useRef<Map<number, unknown>>(new Map());
  const verseRelativeLayoutsRef = useRef<Map<number, VerseLayout>>(new Map());
  const paragraphFramesRef = useRef<Map<number, VerseLayout>>(new Map());
  const paragraphGroupsRef = useRef<Map<number, { verses: number[]; y: number; height: number }>>(
    new Map(),
  );
  const verseFractionsRef = useRef<Map<number, VerseCharFraction>>(new Map());
  const scrollOffsetRef = useRef(0);
  const scrollViewportTopRef = useRef(0);
  const scrollContentAnchorYRef = useRef(0);
  const pendingScrollVerseRef = useRef<number | null>(null);
  const didScrollRef = useRef(false);

  useEffect(() => {
    verseLayoutsRef.current.clear();
    verseNativeTargetsRef.current.clear();
    verseHostsRef.current.clear();
    paragraphHostsRef.current.clear();
    verseRelativeLayoutsRef.current.clear();
    paragraphFramesRef.current.clear();
    paragraphGroupsRef.current.clear();
    verseFractionsRef.current.clear();
    didScrollRef.current = false;
    const v = parseScriptureVerseParam(verseParam);
    pendingScrollVerseRef.current = v;
    setSearchFocusVerse(v);
  }, [chapterData?.bookId, chapterData?.chapter, verseParam]);

  useEffect(() => {
    if (searchFocusVerse == null) return;
    const timer = setTimeout(() => setSearchFocusVerse(null), SEARCH_FOCUS_MS);
    return () => clearTimeout(timer);
  }, [searchFocusVerse, chapterData?.bookId, chapterData?.chapter]);

  const contentAnchorHandle = useCallback((): number | null => {
    const anchor = scrollContentAnchorRef?.current;
    return anchor ? findNodeHandle(anchor) : null;
  }, [scrollContentAnchorRef]);

  const measureAnchorInContent = useCallback(() => {
    const anchorHandle = contentAnchorHandle();
    const scrollHandle = scrollRef.current ? findNodeHandle(scrollRef.current) : null;
    if (anchorHandle == null || scrollHandle == null) return;
    UIManager.measureLayout(
      anchorHandle,
      scrollHandle,
      () => {},
      (_x, y) => {
        if (Number.isFinite(y)) scrollContentAnchorYRef.current = Math.max(0, y);
      },
    );
  }, [contentAnchorHandle, scrollRef]);

  const refreshScrollViewportTop = useCallback(() => {
    const handle = scrollRef.current ? findNodeHandle(scrollRef.current) : null;
    if (handle == null) return;
    UIManager.measureInWindow(handle, (_x: number, y: number) => {
      if (Number.isFinite(y)) scrollViewportTopRef.current = y;
    });
  }, [scrollRef]);

  const recordVerseLayout = useCallback((verseNum: number, y: number, height: number) => {
    if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return;
    const prev = verseLayoutsRef.current.get(verseNum);
    if (prev && Math.abs(prev.y - y) < 1 && Math.abs(prev.height - height) < 1) return;
    verseLayoutsRef.current.set(verseNum, { y: Math.max(0, y), height });
    // 仅搜索定位需要触发滚动；常规布局写入不 bump tick，避免整章反复 setState。
    if (pendingScrollVerseRef.current === verseNum) {
      setVerseLayoutTick((tick) => tick + 1);
    }
  }, []);

  const storeVerseLayout = useCallback(
    (verseNum: number, y: number, height: number, onResult: (layout: VerseLayout | null) => void) => {
      if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) {
        onResult(verseLayoutsRef.current.get(verseNum) ?? null);
        return;
      }
      const nextY = Math.max(0, y);
      const prev = verseLayoutsRef.current.get(verseNum);
      const layout = { y: nextY, height };
      verseLayoutsRef.current.set(verseNum, layout);
      // 搜索定位走 measure 路径时也要 bump，否则不会触发滚到居中
      if (
        pendingScrollVerseRef.current === verseNum &&
        !(prev && Math.abs(prev.y - nextY) < 1 && Math.abs(prev.height - height) < 1)
      ) {
        setVerseLayoutTick((tick) => tick + 1);
      }
      onResult(layout);
    },
    [],
  );

  const measureVerseInWindowContent = useCallback(
    (verseNum: number, target: number, onResult: (layout: VerseLayout | null) => void) => {
      const scrollHandle = scrollRef.current ? findNodeHandle(scrollRef.current) : null;
      if (scrollHandle == null) {
        onResult(verseLayoutsRef.current.get(verseNum) ?? null);
        return;
      }
      UIManager.measureInWindow(scrollHandle, (_sx, scrollWindowY) => {
        UIManager.measureInWindow(target, (_vx, vy, _vw, vh) => {
          if (!Number.isFinite(scrollWindowY) || !Number.isFinite(vy) || !Number.isFinite(vh) || vh <= 0) {
            onResult(verseLayoutsRef.current.get(verseNum) ?? null);
            return;
          }
          const contentY = verseContentYFromWindow(vy, scrollWindowY, scrollOffsetRef.current);
          storeVerseLayout(verseNum, contentY, vh, onResult);
        });
      });
    },
    [scrollRef, storeVerseLayout],
  );

  const measureVerseInContent = useCallback(
    (verseNum: number, target: number, onResult: (layout: VerseLayout | null) => void) => {
      // 与 Web scrollReadChapterVerseIntoView 同构：同步 measureInWindow 配对，避免 stale ref。
      measureVerseInWindowContent(verseNum, target, onResult);
    },
    [measureVerseInWindowContent],
  );

  const registerVerseHost = useCallback((verseNum: number, node: unknown) => {
    if (node == null) {
      verseHostsRef.current.delete(verseNum);
      return;
    }
    verseHostsRef.current.set(verseNum, node);
  }, []);

  const registerParagraphHost = useCallback((verseNums: number[], node: unknown) => {
    for (const verseNum of verseNums) {
      if (node == null) paragraphHostsRef.current.delete(verseNum);
      else paragraphHostsRef.current.set(verseNum, node);
    }
  }, []);

  const reportParagraphVerseBoxes = useCallback(
    (
      boxes: Map<number, VerseLayout>,
      fractions?: Iterable<VerseCharFraction>,
    ) => {
      for (const [verseNum, box] of boxes) {
        if (box.height > 0) verseRelativeLayoutsRef.current.set(verseNum, box);
      }
      if (fractions) {
        for (const fraction of fractions) {
          if (fraction.total > 0) verseFractionsRef.current.set(fraction.verse, fraction);
        }
      }
    },
    [],
  );

  const reportParagraphFrame = useCallback((verseNums: number[], layout: VerseLayout) => {
    if (!(layout.height > 0) || !Number.isFinite(layout.y) || verseNums.length === 0) return;
    const first = verseNums[0]!;
    paragraphGroupsRef.current.set(first, {
      verses: verseNums,
      y: Math.max(0, layout.y),
      height: layout.height,
    });
    for (const verseNum of verseNums) {
      paragraphFramesRef.current.set(verseNum, { y: Math.max(0, layout.y), height: layout.height });
    }
  }, []);

  const reportVerseLayoutFromEvent = useCallback(
    (verseNum: number, event: LayoutChangeEvent) => {
      const host = (event as { target?: unknown }).target;
      if (host != null) verseHostsRef.current.set(verseNum, host);
      const layout = event.nativeEvent.layout;
      if (layout.height > 0 && layout.y > 1 && !verseRelativeLayoutsRef.current.has(verseNum)) {
        verseRelativeLayoutsRef.current.set(verseNum, { y: layout.y, height: layout.height });
      }
      const target = nativeTargetFromLayoutEvent(event);
      if (target != null) {
        verseNativeTargetsRef.current.set(verseNum, target);
        measureVerseInContent(verseNum, target, () => {});
      }
    },
    [measureVerseInContent],
  );

  const remeasureVerseLayoutInContent = useCallback(
    (verseNum: number): Promise<VerseLayout | null> => {
      return new Promise((resolve) => {
        const target = verseNativeTargetsRef.current.get(verseNum);
        if (target == null) {
          resolve(verseLayoutsRef.current.get(verseNum) ?? null);
          return;
        }
        measureVerseInContent(verseNum, target, resolve);
      });
    },
    [measureVerseInContent],
  );

  const scrollVerseToReadableCenter = useCallback(
    (verseNum: number, audioDockVisible = false, animated = true): Promise<boolean> => {
      const chrome = {
        safeTop: safeAreaInsets?.top ?? 0,
        safeBottom: safeAreaInsets?.bottom ?? 0,
        audioDockVisible,
        screenHeight: Dimensions.get("window").height,
      };

      return (async () => {
        if (!scrollRef.current || scrollViewportHeight < 1) return false;
        const viewportH = scrollViewportHeight;
        measureAnchorInContent();
        const measuredRelative = verseRelativeLayoutsRef.current.get(verseNum);
        const paragraphHost = paragraphHostsRef.current.get(verseNum);
        const group = [...paragraphGroupsRef.current.values()].find((item) =>
          item.verses.includes(verseNum),
        );
        const relative = verseRelativeInParagraphGroup(
          verseNum,
          group?.verses ?? [verseNum],
          group?.height ?? 0,
          measuredRelative,
        );

        refreshScrollViewportTop();
        const scrollBox = await measureHostInWindow(scrollRef.current);
        const scrollWindowY = scrollBox?.y ?? scrollViewportTopRef.current;
        const paragraphBox = paragraphHost ? await measureHostInWindow(paragraphHost) : null;
        const verseBox = paragraphBox
          ? verseWindowBoxFromParagraph({
              paragraphWindow: paragraphBox,
              verseNum,
              verses: group?.verses ?? [verseNum],
              fraction: verseFractionsRef.current.get(verseNum),
              measuredRelative,
            })
          : null;
        if (verseBox && verseBox.height > 0) {
          const delta = scrollDeltaToCenterVerseInWindow({
            verseWindowY: verseBox.y,
            verseHeight: verseBox.height,
            scrollWindowY,
            scrollViewportHeight: viewportH,
            chrome,
          });
          if (Number.isFinite(delta) && Math.abs(delta) >= 8) {
            const nextY = nextScrollYFromWindowDelta(
              scrollOffsetRef.current,
              delta,
              viewportH,
              scrollContentHeightRef?.current,
            );
            scrollOffsetRef.current = nextY;
            scrollRef.current.scrollTo({ y: nextY, animated: false });
            return false;
          }
          return Number.isFinite(delta);
        }

        const originY =
          READ_CHAPTER_SCROLL_TOP_PAD +
          (safeAreaInsets?.top ?? 0) +
          Math.max(0, scrollHeaderHeightRef?.current ?? 0);
        const fromFrames = verseContentLayoutFromParagraphFrames({
          verseNum,
          groups: [...paragraphGroupsRef.current.values()],
          relative,
          originY,
        });
        if (!fromFrames) return false;
        const nextY = scrollYToCenterVerse(fromFrames, viewportH, {
          contentHeight: scrollContentHeightRef?.current,
          ...readChapterAudioScrollFocusOpts(chrome.audioDockVisible),
        });
        if (!Number.isFinite(nextY)) return false;
        if (Math.abs(nextY - scrollOffsetRef.current) >= 8) {
          scrollOffsetRef.current = nextY;
          scrollRef.current.scrollTo({ y: nextY, animated: false });
          return false;
        }
        return true;
      })();
    },
    [
      measureAnchorInContent,
      refreshScrollViewportTop,
      safeAreaInsets?.bottom,
      safeAreaInsets?.top,
      scrollContentHeightRef,
      scrollHeaderHeightRef,
      scrollRef,
      scrollViewportHeight,
    ],
  );

  const onScrollViewportLayout = useCallback(
    (height: number) => {
      if (height > 0) {
        const rounded = Math.round(height);
        setScrollViewportHeight(rounded);
        publishReadChapterScrollWindow(scrollOffsetRef.current, rounded);
      }
      refreshScrollViewportTop();
    },
    [refreshScrollViewportTop],
  );

  const onChapterScrollOffset = useCallback((offsetY: number) => {
    scrollOffsetRef.current = Math.max(0, offsetY);
    publishReadChapterScrollWindow(offsetY);
  }, []);

  const onVerseLayout = useCallback(
    (verseNum: number, y: number, height: number) => {
      recordVerseLayout(verseNum, y, height);
    },
    [recordVerseLayout],
  );

  // 与朗读跟读同构：等侧滑转场结束再滚到屏幕可读区中心；前几次成功也继续微调，避免布局未稳
  useEffect(() => {
    const verseNum = pendingScrollVerseRef.current ?? searchFocusVerse;
    if (verseNum == null || didScrollRef.current) return;
    if (!chapterData || scrollViewportHeight < 1 || !scrollRef.current) return;

    let cancelled = false;
    let sawSuccess = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const lastAttempt = SEARCH_SCROLL_RETRY_DELAYS_MS.length - 1;

    const runAttempt = async (attempt: number) => {
      if (cancelled || didScrollRef.current || !scrollRef.current) return;
      const targetVerse = pendingScrollVerseRef.current ?? searchFocusVerse;
      if (targetVerse !== verseNum) return;

      const hasLayout =
        verseLayoutsRef.current.has(verseNum) || verseNativeTargetsRef.current.has(verseNum);
      if (!hasLayout && attempt < lastAttempt) return;

      const ok = await scrollVerseToReadableCenter(verseNum, true, attempt > 0);
      if (cancelled) return;
      if (ok) sawSuccess = true;
      // 至少完成一次转场后的成功滚动，再锁定，避免动画把 scrollY 冲回 0
      if (sawSuccess && attempt >= 1) {
        didScrollRef.current = true;
        pendingScrollVerseRef.current = null;
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      SEARCH_SCROLL_RETRY_DELAYS_MS.forEach((delay, attempt) => {
        timers.push(
          setTimeout(() => {
            requestAnimationFrame(() => {
              void runAttempt(attempt);
            });
          }, delay),
        );
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
      for (const t of timers) clearTimeout(t);
    };
  }, [
    chapterData,
    scrollRef,
    scrollViewportHeight,
    scrollVerseToReadableCenter,
    searchFocusVerse,
    verseLayoutTick,
  ]);

  return {
    searchFocusVerse,
    verseLayoutsRef,
    scrollOffsetRef,
    scrollViewportHeight,
    verseLayoutTick,
    onScrollViewportLayout,
    onChapterScrollOffset,
    onScrollContentAnchorLayout: measureAnchorInContent,
    onVerseLayout,
    reportVerseLayoutFromEvent,
    registerVerseHost,
    registerParagraphHost,
    reportParagraphVerseBoxes,
    reportParagraphFrame,
    remeasureVerseLayoutInContent,
    scrollVerseToReadableCenter,
    refreshScrollViewportTop,
  };
}
