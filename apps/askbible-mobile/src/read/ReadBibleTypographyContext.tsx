import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { InteractionManager } from "react-native";
import { readCuvChapterAudioVoice, subscribeCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import {
  defaultReadBibleTypographyPrefs,
  READ_BIBLE_SIZE_PRESET_LARGE,
  readBibleSizeAtMax,
  readBibleSizeAtMin,
  readBibleTypographyPx,
  readReadBibleTypographyPrefs,
  stepReadBibleSize,
  writeReadBibleTypographyPrefs,
  type ReadBibleTypographyPrefsV1,
  type ReadBibleTypographyPx,
} from "./read-bible-typography-prefs";
import { resolveChapterAudioTranslationId } from "./read-chapter-audio-translation";
import {
  readReadBibleTranslationPrefs,
  subscribeReadBibleTranslation,
  writeReadBibleTranslationPrefMode,
  writeReadBibleTranslationPrefs,
} from "./read-bible-translation-prefs";
import {
  ReadBibleTypographyContext,
  type ReadBibleTypographyContextValue,
} from "./readBibleTypographyContextTypes";
import { syncHomeVersePrefsFromPrimary } from "./readBibleTranslationHomeSync";
import { useReadBibleTranslationCatalogBootstrap } from "./useReadBibleTranslationCatalogBootstrap";
import { getLocale } from "../i18n/locale-store";

export { ReadBibleTypographyContext } from "./readBibleTypographyContextTypes";

export function ReadBibleTypographyProvider({ children }: { children: ReactNode }) {
  const [typography, setTypography] = useState<ReadBibleTypographyPrefsV1>(
    defaultReadBibleTypographyPrefs,
  );
  const [audioVoiceId, setAudioVoiceIdState] = useState<CuvChapterAudioVoiceId>("mandarin");
  const {
    translation,
    setTranslation,
    translationCatalog,
    translationCatalogReady,
    translationIndex,
    refreshTranslationCatalog,
  } = useReadBibleTranslationCatalogBootstrap();
  const contrastWriteSeqRef = useRef(0);

  const refreshVoice = useCallback(() => {
    void readCuvChapterAudioVoice().then(setAudioVoiceIdState);
  }, []);

  const refreshTranslation = useCallback(() => {
    if (!translationCatalogReady) return;
    void readReadBibleTranslationPrefs(translationIndex, getLocale()).then(setTranslation);
  }, [translationCatalogReady, translationIndex, setTranslation]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void readReadBibleTypographyPrefs().then(setTypography);
      refreshVoice();
    });
    const unsub = subscribeCuvChapterAudioVoice(refreshVoice);
    return () => {
      task.cancel();
      unsub();
    };
  }, [refreshVoice]);

  useEffect(() => {
    return subscribeReadBibleTranslation(refreshTranslation);
  }, [refreshTranslation]);

  const px = useMemo(() => readBibleTypographyPx(typography.size), [typography.size]);
  const sizeAtMin = readBibleSizeAtMin(typography.size);
  const sizeAtMax = readBibleSizeAtMax(typography.size);
  const sizeAtDefault = typography.size === defaultReadBibleTypographyPrefs().size;
  const sizeAtLargePreset = typography.size === READ_BIBLE_SIZE_PRESET_LARGE;

  const bumpSize = useCallback((delta: -1 | 1) => {
    setTypography((prev) => {
      const next = { ...prev, size: stepReadBibleSize(prev.size, delta) };
      if (next.size === prev.size) return prev;
      // 字号变更会重排整章经文；持久化放到空闲，避免与重排抢线程。
      InteractionManager.runAfterInteractions(() => {
        void writeReadBibleTypographyPrefs(next);
      });
      return next;
    });
  }, []);

  const resetSizeToDefault = useCallback(() => {
    setTypography((prev) => {
      const next = { ...defaultReadBibleTypographyPrefs() };
      if (next.size === prev.size) return prev;
      void writeReadBibleTypographyPrefs(next);
      return next;
    });
  }, []);

  const setSizeToLargePreset = useCallback(() => {
    setTypography((prev) => {
      const next = { ...prev, size: READ_BIBLE_SIZE_PRESET_LARGE };
      if (next.size === prev.size) return prev;
      void writeReadBibleTypographyPrefs(next);
      return next;
    });
  }, []);

  const setVerseParagraphFlow = useCallback((enabled: boolean) => {
    setTypography((prev) => {
      const next = { ...prev, verseParagraphFlow: enabled };
      if (next.verseParagraphFlow === prev.verseParagraphFlow) return prev;
      void writeReadBibleTypographyPrefs(next);
      return next;
    });
  }, []);

  const setChapterSegmentMode = useCallback((mode: "default" | "t1") => {
    setTypography((prev) => {
      const next = { ...prev, chapterSegmentMode: mode };
      if (next.chapterSegmentMode === prev.chapterSegmentMode) return prev;
      void writeReadBibleTypographyPrefs(next);
      return next;
    });
  }, []);

  const setAudioVoiceId = useCallback(async (id: CuvChapterAudioVoiceId) => {
    const { writeCuvChapterAudioVoice } = await import("../bible/cuv-chapter-audio-voice-prefs");
    await writeCuvChapterAudioVoice(id);
    setAudioVoiceIdState(id);
  }, []);

  const setPrimaryTranslationId = useCallback(
    async (id: string) => {
      await writeReadBibleTranslationPrefMode("manual");
      const next = await writeReadBibleTranslationPrefs(
        {
          ...translation,
          primaryTranslationId: id,
          contrastTranslationIds: translation.contrastTranslationIds.filter((item) => item !== id),
          audioTranslationId: null,
        },
        translationIndex,
      );
      await syncHomeVersePrefsFromPrimary(translationIndex, next.primaryTranslationId, { mode: "manual" });
      setTranslation(next);
    },
    [translation, translationIndex, setTranslation],
  );

  const setContrastTranslationIds = useCallback(
    async (ids: string[]) => {
      const allowed = new Set(translationIndex.translations.map((item) => item.id));
      const seen = new Set<string>();
      const normalized = ids
        .map((item) => item.trim())
        .filter((item) => {
          if (!item) return false;
          if (item === translation.primaryTranslationId) return false;
          if (!allowed.has(item)) return false;
          if (seen.has(item)) return false;
          seen.add(item);
          return true;
        });
      setTranslation((prev) => ({
        ...prev,
        contrastTranslationIds: normalized.filter((item) => item !== prev.primaryTranslationId),
      }));
      const seq = contrastWriteSeqRef.current + 1;
      contrastWriteSeqRef.current = seq;
      const next = await writeReadBibleTranslationPrefs(
        { ...translation, contrastTranslationIds: normalized },
        translationIndex,
      );
      if (contrastWriteSeqRef.current === seq) {
        setTranslation(next);
      }
    },
    [translation, translationIndex, setTranslation],
  );

  const setContrastTranslationId = useCallback(
    async (id: string | null) => {
      await setContrastTranslationIds(id && id.trim() ? [id.trim()] : []);
    },
    [setContrastTranslationIds],
  );

  const setAudioTranslationId = useCallback(
    async (id: string | null) => {
      const next = await writeReadBibleTranslationPrefs(
        { ...translation, audioTranslationId: id && id.trim() ? id.trim() : null },
        translationIndex,
      );
      setTranslation(next);
    },
    [translation, translationIndex, setTranslation],
  );

  const chapterAudioTranslationId = useMemo(
    () => resolveChapterAudioTranslationId(translation, translationIndex),
    [translation, translationIndex],
  );

  const value = useMemo(
    (): ReadBibleTypographyContextValue => ({
      typography,
      px,
      verseParagraphFlow: typography.verseParagraphFlow,
      setVerseParagraphFlow,
      chapterSegmentMode: typography.chapterSegmentMode === "t1" ? "t1" : "default",
      setChapterSegmentMode,
      sizeAtLargePreset,
      setSizeToLargePreset,
      sizeAtMin,
      sizeAtMax,
      sizeAtDefault,
      bumpSize,
      resetSizeToDefault,
      audioVoiceId,
      setAudioVoiceId,
      translation,
      translationCatalog,
      translationCatalogReady,
      refreshTranslationCatalog,
      primaryTranslationId: translation.primaryTranslationId,
      contrastTranslationIds: translation.contrastTranslationIds,
      contrastTranslationId: translation.contrastTranslationIds[0] ?? null,
      audioTranslationId: translation.audioTranslationId,
      chapterAudioTranslationId,
      setPrimaryTranslationId,
      setContrastTranslationIds,
      setContrastTranslationId,
      setAudioTranslationId,
    }),
    [
      typography,
      px,
      setVerseParagraphFlow,
      setChapterSegmentMode,
      sizeAtLargePreset,
      setSizeToLargePreset,
      sizeAtMin,
      sizeAtMax,
      sizeAtDefault,
      bumpSize,
      resetSizeToDefault,
      audioVoiceId,
      setAudioVoiceId,
      translation,
      translationCatalog,
      translationCatalogReady,
      refreshTranslationCatalog,
      chapterAudioTranslationId,
      setPrimaryTranslationId,
      setContrastTranslationIds,
      setContrastTranslationId,
      setAudioTranslationId,
    ],
  );

  return (
    <ReadBibleTypographyContext.Provider value={value}>{children}</ReadBibleTypographyContext.Provider>
  );
}

export function useReadBibleTypographyPx(): ReadBibleTypographyPx {
  const ctx = useContext(ReadBibleTypographyContext);
  return useMemo(
    () => ctx?.px ?? readBibleTypographyPx(defaultReadBibleTypographyPrefs().size),
    [ctx?.px],
  );
}

export function useReadBibleTypography(): ReadBibleTypographyContextValue {
  const ctx = useContext(ReadBibleTypographyContext);
  if (!ctx) {
    throw new Error("useReadBibleTypography must be used within ReadBibleTypographyProvider");
  }
  return ctx;
}
