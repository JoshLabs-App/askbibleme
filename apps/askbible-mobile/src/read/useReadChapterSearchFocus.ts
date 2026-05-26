import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { parseScriptureVerseParam } from "../bible/parse-scripture-verse-param";
import type { LoadedChapter } from "../bible/types";

type VerseLayout = { y: number; height: number };

const SEARCH_FOCUS_MS = 14_000;

export function useReadChapterSearchFocus(
  chapterData: LoadedChapter | null,
  verseParam: string | string[] | undefined,
  scrollRef: React.RefObject<ScrollView | null>,
) {
  const [searchFocusVerse, setSearchFocusVerse] = useState<number | null>(null);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const verseLayoutsRef = useRef<Map<number, VerseLayout>>(new Map());
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

  const scrollToSearchVerse = useCallback(() => {
    const verseNum = pendingScrollVerseRef.current;
    if (verseNum == null || didScrollRef.current || !scrollRef.current) return;
    const layout = verseLayoutsRef.current.get(verseNum);
    if (!layout || scrollViewportHeight < 1) return;

    didScrollRef.current = true;
    pendingScrollVerseRef.current = null;
    const centerY = layout.y + layout.height / 2 - scrollViewportHeight / 2;
    scrollRef.current.scrollTo({ y: Math.max(0, centerY), animated: true });
  }, [scrollRef, scrollViewportHeight]);

  const onScrollViewportLayout = useCallback((height: number) => {
    if (height > 0) setScrollViewportHeight(Math.round(height));
  }, []);

  const onVerseLayout = useCallback(
    (verseNum: number, y: number, height: number) => {
      verseLayoutsRef.current.set(verseNum, { y, height });
      if (pendingScrollVerseRef.current === verseNum) {
        requestAnimationFrame(() => scrollToSearchVerse());
      }
    },
    [scrollToSearchVerse],
  );

  useEffect(() => {
    if (pendingScrollVerseRef.current != null && scrollViewportHeight > 0) {
      scrollToSearchVerse();
    }
  }, [chapterData, scrollViewportHeight, scrollToSearchVerse]);

  return {
    searchFocusVerse,
    onScrollViewportLayout,
    onVerseLayout,
  };
}
