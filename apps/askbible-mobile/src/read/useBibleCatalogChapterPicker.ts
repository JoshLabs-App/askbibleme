import { useCallback, useMemo, useRef, useState } from "react";
import {
  deferAfterRowPress,
  deferChapterPickerNavigation,
  estimateChapterPickerLayout,
  isWithinChapterPickerOpenGuard,
  markChapterPickerOpenGuard,
  resolveChapterPickerViewportHeight,
  resolveChapterPickerWindowWidth,
} from "./BibleChapterPickerPanel";
import { chaptersForBookId, type ScriptureCanonCatalogBook } from "./canonCatalog";

type Args = {
  windowWidth: number;
  windowHeight: number;
  onBookPress?: (book: ScriptureCanonCatalogBook) => void;
  onPickChapter: (bookId: string, chapter: number) => void;
};

export function useBibleCatalogChapterPicker({
  windowWidth,
  windowHeight,
  onBookPress,
  onPickChapter,
}: Args) {
  const [picker, setPicker] = useState<ScriptureCanonCatalogBook | null>(null);
  const chapterPickerOpenGuardUntilRef = useRef(0);
  const chapterPickerModalHeight = resolveChapterPickerViewportHeight(windowHeight);
  const [measuredModalViewportH, setMeasuredModalViewportH] = useState(0);
  const chapterPickerViewportHeight = Math.max(
    chapterPickerModalHeight,
    measuredModalViewportH,
  );
  const chapterPickerLayoutWidth = resolveChapterPickerWindowWidth(windowWidth);
  const chapterPickerLayout = useMemo(() => {
    if (!picker) return null;
    return estimateChapterPickerLayout(
      chaptersForBookId(picker.bookId),
      chapterPickerLayoutWidth,
      chapterPickerViewportHeight,
    );
  }, [chapterPickerLayoutWidth, chapterPickerViewportHeight, picker]);

  const closePicker = useCallback(() => {
    setPicker(null);
    setMeasuredModalViewportH(0);
  }, []);

  const closePickerFromBackdrop = useCallback(() => {
    if (isWithinChapterPickerOpenGuard(chapterPickerOpenGuardUntilRef.current)) return;
    closePicker();
  }, [closePicker]);

  const openBook = useCallback(
    (book: ScriptureCanonCatalogBook) => {
      if (onBookPress) {
        onBookPress(book);
        return;
      }
      const showPicker = () => {
        chapterPickerOpenGuardUntilRef.current = markChapterPickerOpenGuard();
        setPicker(book);
      };
      deferAfterRowPress(showPicker);
    },
    [onBookPress],
  );

  const onPickChapterFromPicker = useCallback(
    (chapter: number) => {
      if (!picker) return;
      closePicker();
      deferChapterPickerNavigation(() => onPickChapter(picker.bookId, chapter));
    },
    [closePicker, onPickChapter, picker],
  );

  return {
    picker,
    chapterPickerLayout,
    chapterPickerModalHeight,
    chapterPickerViewportHeight,
    closePicker,
    closePickerFromBackdrop,
    openBook,
    onPickChapterFromPicker,
    setMeasuredModalViewportH,
  };
}
