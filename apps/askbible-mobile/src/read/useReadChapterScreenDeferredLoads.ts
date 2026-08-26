import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { translationMetaFromCatalog } from "../api/fetchBibleTranslationsCatalog";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { loadRemoteChapter } from "../bible/load-remote-chapter";
import { loadChapterXrefVerseNumbers } from "../bible/load-chapter-xrefs";
import { ensureScriptureTranslationReady } from "../bible/scripture-translation-download";
import { warmScriptureXrefDatabase } from "../bible/scripture-xref-database";
import type { BibleTranslationMeta } from "../bible/translations-types";
import type { LoadedChapter } from "../bible/types";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
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
  const playback = useMusicPlaybackOptional();
  /** 播经中勿定时塞对照/划线/读后块，避免听读中途整章重排；滚动或停播后再加载。 */
  const holdForScriptureAudio = Boolean(
    playback && playback.playbackMode === "scripture" && playback.playing,
  );

  const [contrastByVerse, setContrastByVerse] = useState<Map<number, ContrastVerseLine[]> | null>(null);
  const [contrastLoadRequested, setContrastLoadRequested] = useState(false);
  const [highlightsLoadRequested, setHighlightsLoadRequested] = useState(false);
  const [postReadingReady, setPostReadingReady] = useState(false);
  const [xrefVerseNumbers, setXrefVerseNumbers] = useState<Set<number> | null>(null);

  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const deferredXrefTaskRef = useRef<{ cancel: () => void } | null>(null);
  const deferredContrastTaskRef = useRef<{ cancel: () => void } | null>(null);
  const contrastIdsKey = contrastTranslationIds.join("\0");
  const prevContrastIdsKeyRef = useRef(contrastIdsKey);

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
    if (contrastTranslationIds.length === 0) {
      prevContrastIdsKeyRef.current = contrastIdsKey;
      setContrastByVerse(null);
      setContrastLoadRequested(false);
      return;
    }
    if (!chapterData) return;

    const idsChanged = prevContrastIdsKeyRef.current !== contrastIdsKey;
    prevContrastIdsKeyRef.current = contrastIdsKey;

    if (idsChanged) {
      // 用户刚改对照本：立刻加载，不要再等定时器
      setContrastByVerse(null);
      setContrastLoadRequested(true);
      return;
    }

    if (contrastLoadRequested || holdForScriptureAudio) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setContrastLoadRequested(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [
    chapterData?.bookId,
    chapterData?.chapter,
    chapterFocused,
    contrastLoadRequested,
    contrastIdsKey,
    contrastTranslationIds.length,
    holdForScriptureAudio,
  ]);

  useEffect(() => {
    if (!chapterData || highlightsLoadRequested || holdForScriptureAudio) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setHighlightsLoadRequested(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [
    chapterData?.bookId,
    chapterData?.chapter,
    chapterFocused,
    highlightsLoadRequested,
    holdForScriptureAudio,
  ]);

  useEffect(() => {
    if (!chapterData || postReadingReady || holdForScriptureAudio) return;
    const timer = setTimeout(() => {
      if (chapterFocused) setPostReadingReady(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [
    chapterData?.bookId,
    chapterData?.chapter,
    chapterFocused,
    postReadingReady,
    holdForScriptureAudio,
  ]);

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
          const catalogMeta = translationMetaFromCatalog(catalogIndex, meta.id) ?? meta;
          try {
            await ensureScriptureTranslationReady(meta.id, catalogMeta.downloadUrl, {
              delivery: catalogMeta.delivery,
            });
          } catch {
            continue;
          }
          const loaded =
            catalogMeta.delivery === "chapter-api"
              ? await loadRemoteChapter(catalogMeta, bookId, chapter)
              : await loadChapterFromBundledTranslation(bookId, chapter, meta.id, {
                  labelZh: meta.labelZh,
                  labelEn: meta.labelEn,
                });
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
