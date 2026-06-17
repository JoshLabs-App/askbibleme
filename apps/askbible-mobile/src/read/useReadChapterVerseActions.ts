import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, Platform } from "react-native";
import type { ChapterHighlightMap, VerseActionMenuState } from "./readChapterScreenConstants";
import { cloneHighlightMap } from "./readChapterScreenConstants";
import { readChapterVerseTextHighlights } from "./read-verse-text-highlights";
import type { HighlightWordEditorTarget } from "./ReadVerseHighlightWordSheet";
import type { useScriptureVerseBookmarks } from "./useScriptureVerseBookmarks";
import { useReadChapterVerseMenuActions } from "./useReadChapterVerseMenuActions";

type ChapterData = {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
  verses: Array<{ verse: number; text: string }>;
};

type SwipeApi = { markExclude: () => void } | null;

type Args = {
  chapterData: ChapterData | null;
  chapterFocused: boolean;
  highlightsLoadRequested: boolean;
  displayBookName: string;
  localeZhText: (text: string) => string;
  tr: (key: string, params?: Record<string, string | number>) => string;
  toggleVerseBookmark: ReturnType<typeof useScriptureVerseBookmarks>["toggle"];
  isBookmarked: ReturnType<typeof useScriptureVerseBookmarks>["isBookmarked"];
  swipe: SwipeApi;
};

export function useReadChapterVerseActions({
  chapterData,
  chapterFocused,
  highlightsLoadRequested,
  displayBookName,
  localeZhText,
  tr,
  toggleVerseBookmark,
  isBookmarked,
  swipe,
}: Args) {
  const lastVerseTapRef = useRef<{ verse: number; at: number } | null>(null);
  const longPressCopiedVerseRef = useRef<number | null>(null);
  const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);
  const [verseSelectionMode, setVerseSelectionMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [highlightedVerseIndexes, setHighlightedVerseIndexes] = useState<ChapterHighlightMap>(new Map());
  const [verseActionMenu, setVerseActionMenu] = useState<VerseActionMenuState>(null);
  const [highlightWordEditor, setHighlightWordEditor] = useState<HighlightWordEditorTarget | null>(null);

  const clearBookmarkFeedback = useCallback(() => setBookmarkFeedback(null), []);

  const menuActions = useReadChapterVerseMenuActions({
    chapterData,
    displayBookName,
    localeZhText,
    tr,
    toggleVerseBookmark,
    isBookmarked,
    swipe,
    selectedVerses,
    verseActionMenu,
    setBookmarkFeedback,
    setVerseSelectionMode,
    setSelectedVerses,
    setVerseActionMenu,
    setHighlightWordEditor,
    lastVerseTapRef,
  });

  const onVersePress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      if (highlightWordEditor) return;
      if (verseSelectionMode) {
        setSelectedVerses((prev) =>
          prev.includes(verse)
            ? prev.filter((v) => v !== verse)
            : [...prev, verse].sort((a, b) => a - b),
        );
        swipe?.markExclude();
        return;
      }
      if (longPressCopiedVerseRef.current === verse) {
        longPressCopiedVerseRef.current = null;
        return;
      }
      const now = Date.now();
      const prev = lastVerseTapRef.current;
      if (prev?.verse === verse && now - prev.at < 420) {
        lastVerseTapRef.current = null;
        void (async () => {
          const ref = {
            bookId: chapterData.bookId,
            bookName: displayBookName,
            chapter: chapterData.chapter,
            verse,
            translationId: chapterData.translationId,
            text: localeZhText(text),
          };
          const added = await toggleVerseBookmark(ref);
          void Haptics.notificationAsync(
            added
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          );
          setBookmarkFeedback(
            added ? tr("pages.read.verseBookmarkSaved") : tr("pages.read.verseBookmarkRemoved"),
          );
        })();
        return;
      }
      lastVerseTapRef.current = { verse, at: now };
    },
    [chapterData, highlightWordEditor, verseSelectionMode, toggleVerseBookmark, swipe, localeZhText, tr, displayBookName],
  );

  const onVerseLongPress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      if (highlightWordEditor) return;
      if (verseSelectionMode) return;
      longPressCopiedVerseRef.current = verse;
      swipe?.markExclude();
      setVerseActionMenu({ verse, text });
    },
    [chapterData, highlightWordEditor, swipe, verseSelectionMode],
  );

  const verseBodyPressProps = useCallback(
    (verse: number, text: string) => {
      if (highlightWordEditor || Platform.OS !== "android") return {};
      return {
        onPress: () => onVersePress(verse, text),
        onLongPress: () => onVerseLongPress(verse, text),
      };
    },
    [highlightWordEditor, onVerseLongPress, onVersePress],
  );

  const parentVersePressHandler = useCallback(
    (verse: number, text: string) => {
      if (highlightWordEditor || Platform.OS === "android") return undefined;
      return () => onVersePress(verse, text);
    },
    [highlightWordEditor, onVersePress],
  );

  const parentVerseLongPressHandler = useCallback(
    (verse: number, text: string) => {
      if (highlightWordEditor || Platform.OS === "android") return undefined;
      return () => onVerseLongPress(verse, text);
    },
    [highlightWordEditor, onVerseLongPress],
  );

  const handleHighlightWordSaved = useCallback((verse: number, highlights: Map<number, string> | null) => {
    setHighlightedVerseIndexes((prev) => {
      const next = cloneHighlightMap(prev);
      if (highlights?.size) next.set(verse, highlights);
      else next.delete(verse);
      return next;
    });
  }, []);

  useEffect(() => {
    setVerseSelectionMode(false);
    setSelectedVerses([]);
    setVerseActionMenu(null);
    setHighlightWordEditor(null);
  }, [chapterData?.bookId, chapterData?.chapter]);

  useEffect(() => {
    if (!chapterData || !highlightsLoadRequested) {
      if (!chapterData) setHighlightedVerseIndexes(new Map());
      return;
    }
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readChapterVerseTextHighlights({
        translationId: chapterData.translationId,
        bookId: chapterData.bookId,
        chapter: chapterData.chapter,
      }).then((map) => {
        if (cancelled || !chapterFocused) return;
        setHighlightedVerseIndexes(map);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    chapterData?.translationId,
    chapterData?.bookId,
    chapterData?.chapter,
    chapterFocused,
    highlightsLoadRequested,
  ]);

  return {
    bookmarkFeedback,
    clearBookmarkFeedback,
    verseSelectionMode,
    selectedVerses,
    highlightedVerseIndexes,
    verseActionMenu,
    setVerseActionMenu,
    highlightWordEditor,
    setHighlightWordEditor,
    verseActionMenuBookmarked: menuActions.verseActionMenuBookmarked,
    onVersePress,
    verseBodyPressProps,
    parentVersePressHandler,
    parentVerseLongPressHandler,
    copySelectedVerses: menuActions.copySelectedVerses,
    exitVerseSelectionMode: menuActions.exitVerseSelectionMode,
    runCopyCurrentVerse: menuActions.runCopyCurrentVerse,
    runToggleVerseBookmarkFromMenu: menuActions.runToggleVerseBookmarkFromMenu,
    runStartMultiCopy: menuActions.runStartMultiCopy,
    runOpenHighlightEditor: menuActions.runOpenHighlightEditor,
    handleHighlightWordSaved,
    runShareVerse: menuActions.runShareVerse,
    setBookmarkFeedback,
  };
}
