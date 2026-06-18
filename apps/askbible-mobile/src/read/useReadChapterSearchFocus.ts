import { useCallback, useEffect, useRef, useState } from "react";
import {
  findNodeHandle,
  UIManager,
  type LayoutChangeEvent,
  type ScrollView,
  type View,
} from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { parseScriptureVerseParam } from "../bible/parse-scripture-verse-param";
import type { LoadedChapter } from "../bible/types";
import {
  nativeTargetFromLayoutEvent,
  readChapterReadableCenterWindowY,
  scrollYToCenterVerse,
  scrollYToCenterVerseFromContentAndWindowTarget,
  type VerseLayout,
  verseContentYFromWindow,
} from "./read-chapter-verse-layout";

const SEARCH_FOCUS_MS = 14_000;

export function useReadChapterSearchFocus(
  chapterData: LoadedChapter | null,
  verseParam: string | string[] | undefined,
  scrollRef: React.RefObject<ScrollView | null>,
  scrollContentHeightRef?: React.RefObject<number>,
  scrollContentAnchorRef?: React.RefObject<View | null>,
  safeAreaInsets?: Pick<EdgeInsets, "top" | "bottom">,
) {
  const [searchFocusVerse, setSearchFocusVerse] = useState<number | null>(null);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [verseLayoutTick, setVerseLayoutTick] = useState(0);
  const verseLayoutsRef = useRef<Map<number, VerseLayout>>(new Map());
  const verseNativeTargetsRef = useRef<Map<number, number>>(new Map());
  const scrollOffsetRef = useRef(0);
  const scrollViewportTopRef = useRef(0);
  const scrollContentAnchorYRef = useRef(0);
  const pendingScrollVerseRef = useRef<number | null>(null);
  const didScrollRef = useRef(false);

  useEffect(() => {
    verseLayoutsRef.current.clear();
    verseNativeTargetsRef.current.clear();
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
      const layout = { y: Math.max(0, y), height };
      verseLayoutsRef.current.set(verseNum, layout);
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

  const reportVerseLayoutFromEvent = useCallback(
    (verseNum: number, event: LayoutChangeEvent) => {
      const target = nativeTargetFromLayoutEvent(event);
      if (target != null) verseNativeTargetsRef.current.set(verseNum, target);
      if (target == null) {
        const { y, height } = event.nativeEvent.layout;
        recordVerseLayout(verseNum, y, height);
        return;
      }
      measureVerseInContent(verseNum, target, () => {});
    },
    [measureVerseInContent, recordVerseLayout],
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
      };

      return new Promise((resolve) => {
        if (!scrollRef.current || scrollViewportHeight < 1) {
          resolve(false);
          return;
        }
        const target = verseNativeTargetsRef.current.get(verseNum);
        const scrollHandle = scrollRef.current ? findNodeHandle(scrollRef.current) : null;
        const anchorHandle = contentAnchorHandle();
        if (target == null || scrollHandle == null) {
          resolve(false);
          return;
        }

        measureAnchorInContent();

        UIManager.measureInWindow(scrollHandle, (_sx, scrollWindowY, _sw, scrollWindowH) => {
          const viewportH = scrollWindowH > 0 ? scrollWindowH : scrollViewportHeight;
          const targetCenterWindow = readChapterReadableCenterWindowY(
            scrollWindowY,
            viewportH,
            chrome,
          );

          const finishFromContentY = (verseContentY: number, verseHeight: number) => {
            if (!scrollRef.current || !Number.isFinite(verseContentY) || verseHeight <= 0) {
              resolve(false);
              return;
            }
            const nextY = scrollYToCenterVerseFromContentAndWindowTarget({
              verseContentY,
              verseHeight,
              scrollWindowY,
              targetCenterWindow,
              viewportHeight: viewportH,
              contentHeight: scrollContentHeightRef?.current,
            });
            const currentY = scrollOffsetRef.current;
            if (Math.abs(nextY - currentY) < 8) {
              resolve(true);
              return;
            }
            scrollRef.current.scrollTo({ y: nextY, animated });
            scrollOffsetRef.current = nextY;
            resolve(true);
          };

          if (anchorHandle != null) {
            UIManager.measureLayout(
              anchorHandle,
              scrollHandle,
              () => {
                UIManager.measureInWindow(target, (_vx, verseWindowY, _vw, verseHeight) => {
                  if (!Number.isFinite(verseWindowY) || !Number.isFinite(verseHeight) || verseHeight <= 0) {
                    resolve(false);
                    return;
                  }
                  finishFromContentY(
                    verseContentYFromWindow(verseWindowY, scrollWindowY, scrollOffsetRef.current),
                    verseHeight,
                  );
                });
              },
              (_ax, anchorContentY) => {
                scrollContentAnchorYRef.current = Math.max(0, anchorContentY);
                UIManager.measureLayout(
                  target,
                  anchorHandle,
                  () => {
                    UIManager.measureInWindow(target, (_vx, verseWindowY, _vw, verseHeight) => {
                      if (!Number.isFinite(verseWindowY) || !Number.isFinite(verseHeight) || verseHeight <= 0) {
                        resolve(false);
                        return;
                      }
                      finishFromContentY(
                        verseContentYFromWindow(verseWindowY, scrollWindowY, scrollOffsetRef.current),
                        verseHeight,
                      );
                    });
                  },
                  (_x, y, _w, height) =>
                    finishFromContentY(scrollContentAnchorYRef.current + y, height),
                );
              },
            );
            return;
          }

          UIManager.measureInWindow(target, (_vx, verseWindowY, _vw, verseHeight) => {
            if (!Number.isFinite(verseWindowY) || !Number.isFinite(verseHeight) || verseHeight <= 0) {
              resolve(false);
              return;
            }
            finishFromContentY(
              verseContentYFromWindow(verseWindowY, scrollWindowY, scrollOffsetRef.current),
              verseHeight,
            );
          });
        });
      });
    },
    [
      contentAnchorHandle,
      measureAnchorInContent,
      safeAreaInsets?.bottom,
      safeAreaInsets?.top,
      scrollContentHeightRef,
      scrollRef,
      scrollViewportHeight,
    ],
  );

  const scrollToSearchVerse = useCallback(() => {
    const verseNum = pendingScrollVerseRef.current;
    if (verseNum == null || didScrollRef.current || !scrollRef.current) return;
    const layout = verseLayoutsRef.current.get(verseNum);
    if (!layout || scrollViewportHeight < 1) return;

    didScrollRef.current = true;
    pendingScrollVerseRef.current = null;
    scrollRef.current.scrollTo({
      y: scrollYToCenterVerse(layout, scrollViewportHeight, {
        contentHeight: scrollContentHeightRef?.current,
      }),
      animated: true,
    });
  }, [scrollContentHeightRef, scrollRef, scrollViewportHeight]);

  const onScrollViewportLayout = useCallback(
    (height: number) => {
      if (height > 0) setScrollViewportHeight(Math.round(height));
      refreshScrollViewportTop();
    },
    [refreshScrollViewportTop],
  );

  const onChapterScrollOffset = useCallback(
    (offsetY: number) => {
      scrollOffsetRef.current = Math.max(0, offsetY);
    },
    [],
  );

  const onVerseLayout = useCallback(
    (verseNum: number, y: number, height: number) => {
      recordVerseLayout(verseNum, y, height);
      if (pendingScrollVerseRef.current === verseNum) {
        requestAnimationFrame(() => scrollToSearchVerse());
      }
    },
    [recordVerseLayout, scrollToSearchVerse],
  );

  useEffect(() => {
    if (pendingScrollVerseRef.current != null && scrollViewportHeight > 0) {
      scrollToSearchVerse();
    }
  }, [chapterData, scrollViewportHeight, scrollToSearchVerse, verseLayoutTick]);

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
    remeasureVerseLayoutInContent,
    scrollVerseToReadableCenter,
    refreshScrollViewportTop,
  };
}
