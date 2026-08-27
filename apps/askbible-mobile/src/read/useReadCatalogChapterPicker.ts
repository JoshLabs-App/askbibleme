import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Platform,
  useWindowDimensions,
} from "react-native";
import {
  deferAfterRowPress,
  deferChapterPickerNavigation,
  estimateChapterPickerLayout,
  isWithinChapterPickerOpenGuard,
  markChapterPickerOpenGuard,
  resolveChapterPickerViewportHeight,
  resolveChapterPickerWindowWidth,
} from "./BibleChapterPickerPanel";
import { chaptersForBookId } from "./canonCatalog";

type OpenChapterOpts = {
  planFlow?: boolean;
};

type Args = {
  catalogFocused: boolean;
  openChapterRoute: (
    bookId: string,
    chapter: number,
    opts?: OpenChapterOpts,
  ) => void;
};

export function useReadCatalogChapterPicker({
  catalogFocused,
  openChapterRoute,
}: Args) {
  const [chapterPickerBookId, setChapterPickerBookId] = useState<string | null>(null);
  const [measuredPickerViewportH, setMeasuredPickerViewportH] = useState(0);
  const chapterPickerOpenGuardUntilRef = useRef(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const chapterPickerViewportHeight = Math.max(
    resolveChapterPickerViewportHeight(windowHeight),
    measuredPickerViewportH,
  );
  const chapterPickerLayoutWidth = resolveChapterPickerWindowWidth(windowWidth);
  const chapterPickerLayout = useMemo(() => {
    if (!chapterPickerBookId) return null;
    return estimateChapterPickerLayout(
      chaptersForBookId(chapterPickerBookId),
      chapterPickerLayoutWidth,
      chapterPickerViewportHeight,
    );
  }, [chapterPickerBookId, chapterPickerLayoutWidth, chapterPickerViewportHeight]);

  const closeChapterPicker = useCallback(() => {
    setChapterPickerBookId(null);
    setMeasuredPickerViewportH(0);
  }, []);

  const closeChapterPickerFromBlur = useCallback(() => {
    if (isWithinChapterPickerOpenGuard(chapterPickerOpenGuardUntilRef.current)) return;
    closeChapterPicker();
  }, [closeChapterPicker]);

  const closeChapterPickerFromBackdrop = useCallback(() => {
    if (isWithinChapterPickerOpenGuard(chapterPickerOpenGuardUntilRef.current)) return;
    closeChapterPicker();
  }, [closeChapterPicker]);

  useEffect(() => {
    if (!catalogFocused) {
      closeChapterPickerFromBlur();
    }
  }, [catalogFocused, closeChapterPickerFromBlur]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") closeChapterPicker();
    });
    return () => sub.remove();
  }, [closeChapterPicker]);

  useEffect(() => {
    if (!catalogFocused || !chapterPickerBookId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeChapterPicker();
      return true;
    });
    return () => sub.remove();
  }, [catalogFocused, chapterPickerBookId, closeChapterPicker]);

  const openChapter = useCallback(
    (bookId: string, chapter: number, opts?: OpenChapterOpts) => {
      closeChapterPicker();
      const navigate = () => {
        openChapterRoute(bookId, chapter, opts);
      };
      deferChapterPickerNavigation(navigate);
    },
    [closeChapterPicker, openChapterRoute],
  );

  const onCatalogTestamentChange = useCallback(() => {
    closeChapterPicker();
  }, [closeChapterPicker]);

  const onCatalogBookPress = useCallback((book: { bookId: string }) => {
    const show = () => {
      chapterPickerOpenGuardUntilRef.current = markChapterPickerOpenGuard();
      setChapterPickerBookId(book.bookId);
    };
    deferAfterRowPress(show);
  }, []);

  return {
    chapterPickerBookId,
    chapterPickerLayout,
    chapterPickerViewportHeight,
    setMeasuredPickerViewportH,
    closeChapterPicker,
    closeChapterPickerFromBackdrop,
    openChapter,
    onCatalogTestamentChange,
    onCatalogBookPress,
    windowHeight,
  };
}
