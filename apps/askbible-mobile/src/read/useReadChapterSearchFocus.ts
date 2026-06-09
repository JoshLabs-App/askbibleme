import { useCallback, useEffect, useRef, useState } from "react";
import { UIManager, type LayoutChangeEvent, type ScrollView } from "react-native";
import { parseScriptureVerseParam } from "../bible/parse-scripture-verse-param";
import type { LoadedChapter } from "../bible/types";
import {
  nativeTargetFromLayoutEvent,
  scrollYToCenterVerse,
  type VerseLayout,
  verseContentYFromWindow,
} from "./read-chapter-verse-layout";

const SEARCH_FOCUS_MS = 14_000;

export function useReadChapterSearchFocus(
  chapterData: LoadedChapter | null,
  verseParam: string | string[] | undefined,
  scrollRef: React.RefObject<ScrollView | null>,
) {
  const [searchFocusVerse, setSearchFocusVerse] = useState<number | null>(null);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [verseLayoutTick, setVerseLayoutTick] = useState(0);
  const verseLayoutsRef = useRef<Map<number, VerseLayout>>(new Map());
  const scrollOffsetRef = useRef(0);
  const scrollViewportTopRef = useRef(0);
  const pendingScrollVerseRef = useRef<number | null>(null);
  const didScrollRef = useRef(false);

  useEffect(() => {
    verseLayoutsRef.current.clear();
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

  const refreshScrollViewportTop = useCallback(() => {
    scrollRef.current?.measureInWindow((_x, y) => {
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

  const reportVerseLayoutFromEvent = useCallback(
    (verseNum: number, event: LayoutChangeEvent) => {
      const target = nativeTargetFromLayoutEvent(event);
      if (target == null) {
        const { y, height } = event.nativeEvent.layout;
        recordVerseLayout(verseNum, y, height);
        return;
      }
      UIManager.measureInWindow(target, (_vx, vy, _vw, vh) => {
        const contentY = verseContentYFromWindow(
          vy,
          scrollViewportTopRef.current,
          scrollOffsetRef.current,
        );
        recordVerseLayout(verseNum, contentY, vh);
      });
    },
    [recordVerseLayout],
  );

  const scrollToSearchVerse = useCallback(() => {
    const verseNum = pendingScrollVerseRef.current;
    if (verseNum == null || didScrollRef.current || !scrollRef.current) return;
    const layout = verseLayoutsRef.current.get(verseNum);
    if (!layout || scrollViewportHeight < 1) return;

    didScrollRef.current = true;
    pendingScrollVerseRef.current = null;
    scrollRef.current.scrollTo({
      y: scrollYToCenterVerse(layout, scrollViewportHeight),
      animated: true,
    });
  }, [scrollRef, scrollViewportHeight]);

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
    onVerseLayout,
    reportVerseLayoutFromEvent,
    refreshScrollViewportTop,
  };
}
