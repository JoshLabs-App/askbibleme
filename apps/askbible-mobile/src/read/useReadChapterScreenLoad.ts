import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { loadBundledChapterSegments } from "../bible/bundled-chapter-segments";
import type { ChapterSegment } from "../bible/types";
import type { LoadedChapter } from "../bible/types";
import type { BibleTranslationMeta } from "../bible/translations-types";
import { t } from "../i18n/site-copy";
import { loadReadChapterScreenChapter } from "./loadReadChapterScreenChapter";
import { isNativeDatabaseRejectedError } from "../bible/scripture-database";
import { useReadChapterScreenDeferredLoads } from "./useReadChapterScreenDeferredLoads";

type Args = {
  bookId: string;
  chapter: number | null;
  chapterFocused: boolean;
  chapterCompleted: boolean;
  primaryTranslationId: string;
  translationCatalogReady: boolean;
  translationCatalog: BibleTranslationMeta[];
  contrastTranslationIds: string[];
  chapterSegmentMode: "default" | "t1";
  preferEnglishSegmentTitles: boolean;
  navigation: { isFocused: () => boolean };
  scrollRef: React.RefObject<ScrollView | null>;
  lastRecordedFractionRef: React.MutableRefObject<{
    bookId: string;
    chapter: number;
    fraction: number;
  } | null>;
  onChapterRouteChange: () => void;
};

export function useReadChapterScreenLoad({
  bookId,
  chapter,
  chapterFocused,
  chapterCompleted,
  primaryTranslationId,
  translationCatalogReady,
  translationCatalog,
  contrastTranslationIds,
  chapterSegmentMode,
  preferEnglishSegmentTitles,
  navigation,
  scrollRef,
  lastRecordedFractionRef,
  onChapterRouteChange,
}: Args) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterData, setChapterData] = useState<LoadedChapter | null>(null);
  const [chapterSegments, setChapterSegments] = useState<ChapterSegment[] | null>(null);

  const chapterDataRef = useRef(chapterData);
  chapterDataRef.current = chapterData;
  const translationCatalogRef = useRef(translationCatalog);
  translationCatalogRef.current = translationCatalog;
  const chapterLoadSeqRef = useRef(0);
  const chapterScrollIntentRef = useRef(false);

  const {
    contrastByVerse,
    contrastLoadRequested,
    setContrastLoadRequested,
    highlightsLoadRequested,
    setHighlightsLoadRequested,
    postReadingReady,
    setPostReadingReady,
    xrefVerseNumbers,
    scheduleXrefAfterChapterLoad,
    cancelDeferredTasks,
  } = useReadChapterScreenDeferredLoads({
    bookId,
    chapter,
    chapterFocused,
    chapterCompleted,
    chapterData,
    contrastTranslationIds,
    translationCatalog,
    navigation,
    chapterLoadSeqRef,
  });

  const load = useCallback(async () => {
    if (!translationCatalogReady) {
      const cached = chapterDataRef.current;
      if (
        cached?.bookId === bookId &&
        cached?.chapter === chapter &&
        cached?.translationId === primaryTranslationId
      ) {
        setChapterData(cached);
        setLoading(false);
        setError(null);
      } else {
        setLoading(true);
      }
      return;
    }

    const loadSeq = chapterLoadSeqRef.current;
    if (!bookId || chapter == null) {
      setError(t("pages.read.invalidChapter"));
      setChapterData(null);
      setLoading(false);
      return;
    }

    const cached = chapterDataRef.current;
    const hasCachedChapter =
      cached?.bookId === bookId &&
      cached?.chapter === chapter &&
      cached?.translationId === primaryTranslationId;

    if (!hasCachedChapter) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await loadReadChapterScreenChapter({
        bookId,
        chapter,
        primaryTranslationId,
        chapterSegmentMode,
        preferEnglishSegmentTitles,
        translationCatalog: translationCatalogRef.current,
        loadSeq,
        chapterLoadSeqRef,
        cancelDeferredTasks,
        scheduleXrefAfterChapterLoad,
      });

      if (loadSeq !== chapterLoadSeqRef.current) return;

      if (!result.ok) {
        setChapterData(result.chapter);
        if (result.error) setError(result.error);
        return;
      }

      setChapterData(result.chapter);
      setChapterSegments(result.segments);
    } catch (e) {
      if (loadSeq !== chapterLoadSeqRef.current) return;
      setChapterData(null);
      if (isNativeDatabaseRejectedError(e)) {
        setError(t("pages.read.chapterLoadError"));
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (loadSeq === chapterLoadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [
    bookId,
    chapter,
    primaryTranslationId,
    chapterSegmentMode,
    translationCatalogReady,
    preferEnglishSegmentTitles,
    cancelDeferredTasks,
    scheduleXrefAfterChapterLoad,
  ]);

  useEffect(() => {
    if (!chapterData || !translationCatalogReady) return;
    setChapterSegments(
      loadBundledChapterSegments(chapterData.bookId, chapterData.chapter, chapterSegmentMode, {
        preferEnglishTitles: preferEnglishSegmentTitles,
      }),
    );
  }, [
    chapterData?.bookId,
    chapterData?.chapter,
    chapterSegmentMode,
    preferEnglishSegmentTitles,
    translationCatalogReady,
  ]);

  useLayoutEffect(() => {
    chapterLoadSeqRef.current += 1;
    setChapterData(null);
    setChapterSegments(null);
    lastRecordedFractionRef.current = null;
    setLoading(true);
    setError(null);
    chapterScrollIntentRef.current = false;
    onChapterRouteChange();
  }, [bookId, chapter, lastRecordedFractionRef, onChapterRouteChange]);

  const prevPrimaryTranslationIdRef = useRef(primaryTranslationId);
  useEffect(() => {
    if (prevPrimaryTranslationIdRef.current === primaryTranslationId) return;
    prevPrimaryTranslationIdRef.current = primaryTranslationId;
    chapterLoadSeqRef.current += 1;
    void load();
  }, [primaryTranslationId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!bookId || chapter == null) return;
      const cached = chapterDataRef.current;
      if (
        cached?.bookId === bookId &&
        cached?.chapter === chapter &&
        cached?.translationId === primaryTranslationId
      ) {
        setChapterData(cached);
        setLoading(false);
        setError(null);
        return;
      }
      if (!translationCatalogReady) {
        setLoading(true);
        return;
      }
      void load();
    }, [bookId, chapter, primaryTranslationId, load, translationCatalogReady]),
  );

  useEffect(() => {
    if (!chapterFocused || loading || error || chapterData) return;
    if (!bookId || chapter == null) return;
    if (!translationCatalogReady) {
      setLoading(true);
      return;
    }
    setLoading(true);
    void load();
  }, [
    bookId,
    chapter,
    chapterData,
    chapterFocused,
    error,
    load,
    loading,
    translationCatalogReady,
  ]);

  useEffect(() => {
    if (!chapterFocused || !translationCatalogReady || !bookId || chapter == null) return;
    const cached = chapterDataRef.current;
    if (
      cached?.bookId === bookId &&
      cached?.chapter === chapter &&
      cached?.translationId === primaryTranslationId
    ) {
      return;
    }
    void load();
  }, [bookId, chapter, chapterFocused, load, primaryTranslationId, translationCatalogReady]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [bookId, chapter, scrollRef]);

  return {
    loading,
    error,
    chapterData,
    chapterDataRef,
    chapterSegments,
    contrastByVerse,
    contrastLoadRequested,
    setContrastLoadRequested,
    highlightsLoadRequested,
    setHighlightsLoadRequested,
    postReadingReady,
    setPostReadingReady,
    xrefVerseNumbers,
    chapterScrollIntentRef,
    load,
  };
}
