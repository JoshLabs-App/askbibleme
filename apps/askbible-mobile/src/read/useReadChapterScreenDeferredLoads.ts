import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { translationMetaFromCatalog } from "../api/fetchBibleTranslationsCatalog";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { loadChapterXrefVerseNumbers } from "../bible/load-chapter-xrefs";
import { ensureScriptureTranslationReady } from "../bible/scripture-translation-download";
import { warmScriptureXrefDatabase } from "../bible/scripture-xref-database";
import type { BibleTranslationMeta } from "../bible/translations-types";
import type { LoadedChapter } from "../bible/types";
import type { ContrastVerseLine } from "./readChapterScreenConstants";

type Args = {
  bookId: string;
  chapter: number | null;
  chapterFocused: boolean;
  chapterCompleted: boolean;
  chapterData: LoadedChapter | null;
  contrastTranslationIds: string[];
  translationCatalog: BibleTranslationMeta[];
  navigation: { isFocused: () => boolean };
  chapterLoadSeqRef: React.MutableRefObject<number>;
};

export function useReadChapterScreenDeferredLoads({
  bookId,
  chapter,
  chapterFocused,
  chapterCompleted,
  chapterData,
  contrastTranslationIds,
  translationCatalog,
  navigation,
  chapterLoadSeqRef,
}: Args) {
  const [contrastByVerse, setContrastByVerse] = useState<Map<number, ContrastVerseLine[]> | null>(null);
  const [contrastLoadRequested, setContrastLoadRequested] = useState(false);
  const [highlightsLoadRequested, setHighlightsLoadRequested] = useState(false);
  const [postReadingReady, setPostReadingReady] = useState(false);
  const [xrefVerseNumbers, setXrefVerseNumbers] = useState<Set<number> | null>(null);

  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const deferredXrefTaskRef = useRef<{ cancel: () => void } | null>(null);
  const deferredContrastTaskRef = useRef<{ cancel: () => void } | null>(null);

  const cancelDeferredTasks = useCallback(() => {
    deferredXrefTaskRef.current?.cancel();
    deferredContrastTaskRef.current?.cancel();
  }, []);

  const scheduleXrefAfterChapterLoad = useCallback(
    (loadSeq: number) => {
      if (chapter == null) return;
      deferredXrefTaskRef.current?.cancel();
      deferredXrefTaskRef.current = InteractionManager.runAfterInteractions(() => {
        void (async () => {
          if (!navigationRef.current.isFocused()) return;
          await warmScriptureXrefDatabase();
          if (!navigationRef.current.isFocused()) return;
          const verseNumbers = await loadChapterXrefVerseNumbers(bookId, chapter);
          if (!navigationRef.current.isFocused()) return;
          if (loadSeq !== chapterLoadSeqRef.current) return;
          setXrefVerseNumbers(verseNumbers.length ? new Set(verseNumbers) : new Set());
        })();
      });
    },
    [bookId, chapter, chapterLoadSeqRef],
  );

  useLayoutEffect(() => {
    setContrastByVerse(null);
    setContrastLoadRequested(false);
    setHighlightsLoadRequested(false);
    setPostReadingReady(false);
    setXrefVerseNumbers(null);
    cancelDeferredTasks();
  }, [bookId, chapter, cancelDeferredTasks]);

  useEffect(() => {
    return () => {
      cancelDeferredTasks();
    };
  }, [cancelDeferredTasks]);

  useEffect(() => {
    if (!chapterData || contrastTranslationIds.length === 0 || contrastLoadRequested) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setContrastLoadRequested(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [
    chapterData?.bookId,
    chapterData?.chapter,
    chapterFocused,
    contrastLoadRequested,
    contrastTranslationIds.length,
  ]);

  useEffect(() => {
    if (!chapterData || highlightsLoadRequested) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setHighlightsLoadRequested(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [chapterData?.bookId, chapterData?.chapter, chapterFocused, highlightsLoadRequested]);

  useEffect(() => {
    if (!chapterData || postReadingReady) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setPostReadingReady(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [chapterData?.bookId, chapterData?.chapter, chapterFocused, postReadingReady]);

  useEffect(() => {
    if (chapterCompleted) setPostReadingReady(true);
  }, [chapterCompleted]);

  useEffect(() => {
    if (!chapterData || !contrastLoadRequested || contrastTranslationIds.length === 0) return;

    const contrastMetas = contrastTranslationIds
      .map((id) => translationCatalog.find((tr) => tr.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!contrastMetas.length) return;

    const catalogIndex = {
      translations: translationCatalog,
      defaultTranslationId: null as string | null,
    };

    deferredContrastTaskRef.current?.cancel();
    deferredContrastTaskRef.current = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        if (chapter == null) return;
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        if (!navigation.isFocused()) return;

        const map = new Map<number, ContrastVerseLine[]>();
        for (const meta of contrastMetas) {
          if (!navigation.isFocused()) return;
          try {
            await ensureScriptureTranslationReady(
              meta.id,
              translationMetaFromCatalog(catalogIndex, meta.id)?.downloadUrl,
            );
          } catch {
            continue;
          }
          const loaded = await loadChapterFromBundledTranslation(
            bookId,
            chapter,
            meta.id,
            { labelZh: meta.labelZh, labelEn: meta.labelEn },
          );
          if (!loaded?.verses?.length) continue;
          for (const v of loaded.verses) {
            const bucket = map.get(v.verse) ?? [];
            bucket.push({ translationId: loaded.translationId, text: v.text });
            map.set(v.verse, bucket);
          }
        }
        if (!navigation.isFocused()) return;
        setContrastByVerse(map.size ? map : null);
      })();
    });

    return () => {
      deferredContrastTaskRef.current?.cancel();
    };
  }, [
    bookId,
    chapter,
    chapterData,
    contrastLoadRequested,
    contrastTranslationIds,
    navigation,
    translationCatalog,
  ]);

  return {
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
  };
}
