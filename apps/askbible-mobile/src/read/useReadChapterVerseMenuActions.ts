import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { Share } from "react-native";
import {
  copyScriptureVerseToClipboard,
  copyTextToClipboard,
} from "../bible/copy-scripture-verse-clipboard";
import type { VerseActionMenuState } from "./readChapterScreenConstants";

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
  displayBookName: string;
  localeZhText: (text: string) => string;
  tr: (key: string, params?: Record<string, string | number>) => string;
  toggleVerseBookmark: (ref: {
    bookId: string;
    bookName: string;
    chapter: number;
    verse: number;
    translationId: string;
    text: string;
  }) => Promise<boolean>;
  isBookmarked: (ref: {
    translationId: string;
    bookId: string;
    chapter: number;
    verse: number;
  }) => boolean;
  swipe: SwipeApi;
  selectedVerses: number[];
  verseActionMenu: VerseActionMenuState;
  setBookmarkFeedback: (msg: string | null) => void;
  setVerseSelectionMode: (on: boolean) => void;
  setSelectedVerses: React.Dispatch<React.SetStateAction<number[]>>;
  setVerseActionMenu: React.Dispatch<React.SetStateAction<VerseActionMenuState>>;
  setHighlightWordEditor: React.Dispatch<
    React.SetStateAction<{ verse: number; text: string } | null>
  >;
  lastVerseTapRef: React.MutableRefObject<{ verse: number; at: number } | null>;
};

export function useReadChapterVerseMenuActions({
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
}: Args) {
  const copySelectedVerses = useCallback(async () => {
    if (!chapterData || selectedVerses.length === 0) {
      setBookmarkFeedback(tr("pages.read.verseSelectionEmpty"));
      return;
    }
    swipe?.markExclude();
    const selectedText = selectedVerses
      .map((verse) => {
        const row = chapterData.verses.find((v) => v.verse === verse);
        return row
          ? `${displayBookName} ${chapterData.chapter}:${verse} ${localeZhText(row.text)}`
          : null;
      })
      .filter((x): x is string => Boolean(x))
      .join("\n");
    const ok = await copyTextToClipboard(selectedText);
    void Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
    setBookmarkFeedback(
      ok
        ? tr("pages.read.verseSelectionCopied", { count: selectedVerses.length })
        : tr("pages.read.verseCopyFailed"),
    );
    lastVerseTapRef.current = null;
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, [
    chapterData,
    displayBookName,
    localeZhText,
    selectedVerses,
    swipe,
    tr,
    setBookmarkFeedback,
    setVerseSelectionMode,
    setSelectedVerses,
    lastVerseTapRef,
  ]);

  const exitVerseSelectionMode = useCallback(() => {
    lastVerseTapRef.current = null;
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, [lastVerseTapRef, setVerseSelectionMode, setSelectedVerses]);

  const runCopyCurrentVerse = useCallback(async () => {
    if (!chapterData || !verseActionMenu) return;
    const copied = await copyScriptureVerseToClipboard({
      bookName: displayBookName,
      chapter: chapterData.chapter,
      verse: verseActionMenu.verse,
      text: localeZhText(verseActionMenu.text),
    });
    void Haptics.notificationAsync(
      copied
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    setBookmarkFeedback(copied ? tr("pages.read.verseCopied") : tr("pages.read.verseCopyFailed"));
    setVerseActionMenu(null);
  }, [chapterData, displayBookName, verseActionMenu, localeZhText, tr, setBookmarkFeedback, setVerseActionMenu]);

  const runToggleVerseBookmarkFromMenu = useCallback(async () => {
    if (!chapterData || !verseActionMenu) return;
    const ref = {
      bookId: chapterData.bookId,
      bookName: displayBookName,
      chapter: chapterData.chapter,
      verse: verseActionMenu.verse,
      translationId: chapterData.translationId,
      text: localeZhText(verseActionMenu.text),
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
    setVerseActionMenu(null);
  }, [
    chapterData,
    displayBookName,
    localeZhText,
    toggleVerseBookmark,
    tr,
    verseActionMenu,
    setBookmarkFeedback,
    setVerseActionMenu,
  ]);

  const verseActionMenuBookmarked = useMemo(() => {
    if (!chapterData || !verseActionMenu) return false;
    return isBookmarked({
      translationId: chapterData.translationId,
      bookId: chapterData.bookId,
      chapter: chapterData.chapter,
      verse: verseActionMenu.verse,
    });
  }, [chapterData, isBookmarked, verseActionMenu]);

  const runStartMultiCopy = useCallback(() => {
    if (!verseActionMenu) return;
    setVerseSelectionMode(true);
    setSelectedVerses([verseActionMenu.verse]);
    setVerseActionMenu(null);
  }, [verseActionMenu, setVerseSelectionMode, setSelectedVerses, setVerseActionMenu]);

  const runOpenHighlightEditor = useCallback(() => {
    if (!verseActionMenu) return;
    setHighlightWordEditor({
      verse: verseActionMenu.verse,
      text: localeZhText(verseActionMenu.text),
    });
    setVerseActionMenu(null);
  }, [localeZhText, verseActionMenu, setHighlightWordEditor, setVerseActionMenu]);

  const runShareVerse = useCallback(() => {
    if (!chapterData || !verseActionMenu) return;
    const message = `${displayBookName} ${chapterData.chapter}:${verseActionMenu.verse}\n${localeZhText(verseActionMenu.text)}`;
    void Share.share({ message })
      .then(() => {
        setVerseActionMenu(null);
      })
      .catch(() => {
        setBookmarkFeedback(tr("pages.read.verseShareFailed"));
        setVerseActionMenu(null);
      });
  }, [
    chapterData,
    verseActionMenu,
    localeZhText,
    displayBookName,
    tr,
    setBookmarkFeedback,
    setVerseActionMenu,
  ]);

  return {
    copySelectedVerses,
    exitVerseSelectionMode,
    runCopyCurrentVerse,
    runToggleVerseBookmarkFromMenu,
    verseActionMenuBookmarked,
    runStartMultiCopy,
    runOpenHighlightEditor,
    runShareVerse,
  };
}
