import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  bundledBibleTranslationsCatalog,
  fetchBibleTranslationsCatalog,
  fetchBibleTranslationsCatalogFresh,
} from "../api/fetchBibleTranslationsCatalog";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { preloadPrimaryScriptureTranslation } from "../bible/scripture-translation-download";
import { inferAppLocaleFromDevice } from "../i18n/config";
import {
  getLocale,
  hydrateLocaleFromStorage,
  subscribeLocale,
} from "../i18n/locale-store";
import { readCuvChapterAudioVoice, subscribeCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "../bible/translations-types";
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
  hasReadBibleTranslationPrefsStored,
  readReadBibleTranslationPrefMode,
  readReadBibleTranslationPrefs,
  resolveDefaultPrimaryTranslationId,
  subscribeReadBibleTranslation,
  writeReadBibleTranslationPrefMode,
  writeReadBibleTranslationPrefs,
  type ReadBibleTranslationPrefsV1,
} from "./read-bible-translation-prefs";
import {
  defaultHomePrimaryTranslationIdForLocale,
  readHomePrayerVersePrefs,
  writeHomePrayerVersePrefs,
} from "../home/homePrayerVersePrefs";

type ReadBibleTypographyContextValue = {
  typography: ReadBibleTypographyPrefsV1;
  px: ReadBibleTypographyPx;
  verseParagraphFlow: boolean;
  setVerseParagraphFlow: (enabled: boolean) => void;
  chapterSegmentMode: "default" | "t1";
  setChapterSegmentMode: (mode: "default" | "t1") => void;
  sizeAtLargePreset: boolean;
  setSizeToLargePreset: () => void;
  sizeAtMin: boolean;
  sizeAtMax: boolean;
  sizeAtDefault: boolean;
  bumpSize: (delta: -1 | 1) => void;
  resetSizeToDefault: () => void;
  audioVoiceId: CuvChapterAudioVoiceId;
  setAudioVoiceId: (id: CuvChapterAudioVoiceId) => Promise<void>;
  translation: ReadBibleTranslationPrefsV1;
  translationCatalog: BibleTranslationMeta[];
  translationCatalogReady: boolean;
  refreshTranslationCatalog: () => Promise<void>;
  primaryTranslationId: string;
  contrastTranslationIds: string[];
  contrastTranslationId: string | null;
  audioTranslationId: string | null;
  chapterAudioTranslationId: string;
  setPrimaryTranslationId: (id: string) => Promise<void>;
  setContrastTranslationIds: (ids: string[]) => Promise<void>;
  setContrastTranslationId: (id: string | null) => Promise<void>;
  setAudioTranslationId: (id: string | null) => Promise<void>;
};

export const ReadBibleTypographyContext = createContext<ReadBibleTypographyContextValue | null>(null);

export function ReadBibleTypographyProvider({ children }: { children: ReactNode }) {
  const [typography, setTypography] = useState<ReadBibleTypographyPrefsV1>(
    defaultReadBibleTypographyPrefs,
  );
  const [audioVoiceId, setAudioVoiceIdState] = useState<CuvChapterAudioVoiceId>("mandarin");
  const [translation, setTranslation] = useState<ReadBibleTranslationPrefsV1>(() => ({
    version: 1,
    primaryTranslationId: resolveDefaultPrimaryTranslationId(
      { translations: [], defaultTranslationId: null },
      inferAppLocaleFromDevice(),
    ),
    contrastTranslationIds: [],
    audioTranslationId: null,
  }));
  const [translationCatalog, setTranslationCatalog] = useState<BibleTranslationMeta[]>([]);
  const [defaultTranslationId, setDefaultTranslationId] = useState<string | null>("cuv-simp");
  const [translationCatalogReady, setTranslationCatalogReady] = useState(false);
  const contrastWriteSeqRef = useRef(0);

  const translationIndex = useMemo(
    (): BibleTranslationsIndex => ({
      translations: translationCatalog,
      defaultTranslationId: defaultTranslationId ?? translationCatalog[0]?.id ?? "cuv-simp",
    }),
    [translationCatalog, defaultTranslationId],
  );

  const syncHomeVersePrefsFromPrimary = useCallback(
    async (primaryId: string, opts?: { mode?: "auto" | "manual" }) => {
      const tr = translationIndex.translations.find((item) => item.id === primaryId);
      const isEnglish = /^en\b/i.test(tr?.language ?? "");
      const home = await readHomePrayerVersePrefs();
      const mode = opts?.mode ?? home.primaryTranslationMode;
      if (mode === "auto") {
        const locale = getLocale();
        await writeHomePrayerVersePrefs({
          ...home,
          primaryTranslationMode: "auto",
          verseTextZhTranslationId: defaultHomePrimaryTranslationIdForLocale(locale),
          verseTextEnTranslationId: "",
        });
        return;
      }
      if (isEnglish) {
        if (home.verseTextEnTranslationId === primaryId && home.primaryTranslationMode === "manual") return;
        await writeHomePrayerVersePrefs({
          ...home,
          primaryTranslationMode: "manual",
          verseTextEnTranslationId: primaryId,
        });
        return;
      }
      if (home.verseTextZhTranslationId === primaryId && home.primaryTranslationMode === "manual") return;
      await writeHomePrayerVersePrefs({
        ...home,
        primaryTranslationMode: "manual",
        verseTextZhTranslationId: primaryId,
      });
    },
    [translationIndex],
  );

  const refreshVoice = useCallback(() => {
    void readCuvChapterAudioVoice().then(setAudioVoiceIdState);
  }, []);

  const refreshTranslation = useCallback(() => {
    if (!translationCatalogReady) return;
    void readReadBibleTranslationPrefs(translationIndex, getLocale()).then(setTranslation);
  }, [translationCatalogReady, translationIndex]);

  const syncAutoTranslationForLocale = useCallback(async () => {
    if (!translationCatalogReady) return;
    const locale = getLocale();
    const mode = await readReadBibleTranslationPrefMode();
    if (mode !== "auto") return;
    const prefs = await readReadBibleTranslationPrefs(translationIndex, locale);
    const normalized = await writeReadBibleTranslationPrefs(prefs, translationIndex);
    await syncHomeVersePrefsFromPrimary(normalized.primaryTranslationId, { mode: "auto" });
    setTranslation(normalized);
  }, [translationCatalogReady, translationIndex, syncHomeVersePrefsFromPrimary]);

  useEffect(() => {
    void readReadBibleTypographyPrefs().then(setTypography);
    refreshVoice();
    return subscribeCuvChapterAudioVoice(refreshVoice);
  }, [refreshVoice]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateLocaleFromStorage();
      const locale = getLocale();
      const offlineIndex = bundledBibleTranslationsCatalog();
      const earlyPrimary = resolveDefaultPrimaryTranslationId(offlineIndex, locale);
      void preloadPrimaryScriptureTranslation(earlyPrimary);
      const index = isMobileOfflineFirst()
        ? bundledBibleTranslationsCatalog()
        : await fetchBibleTranslationsCatalog();
      if (cancelled) return;
      setTranslationCatalog(index.translations);
      setDefaultTranslationId(index.defaultTranslationId);
      const hasStoredPrefs = await hasReadBibleTranslationPrefsStored();
      let normalized: ReadBibleTranslationPrefsV1;
      if (!hasStoredPrefs) {
        const localeDefaultPrimary = resolveDefaultPrimaryTranslationId(index, locale);
        normalized = await writeReadBibleTranslationPrefs(
          {
            version: 1,
            primaryTranslationId: localeDefaultPrimary,
            contrastTranslationIds: [],
            audioTranslationId: null,
          },
          index,
        );
        await writeReadBibleTranslationPrefMode("auto");
        await syncHomeVersePrefsFromPrimary(normalized.primaryTranslationId, { mode: "auto" });
      } else {
        const prefs = await readReadBibleTranslationPrefs(index, locale);
        normalized = await writeReadBibleTranslationPrefs(prefs, index);
        const mode = await readReadBibleTranslationPrefMode();
        if (mode === "auto") {
          await syncHomeVersePrefsFromPrimary(normalized.primaryTranslationId, { mode: "auto" });
        }
      }
      if (!cancelled) {
        setTranslation(normalized);
        setTranslationCatalogReady(true);
        void preloadPrimaryScriptureTranslation(normalized.primaryTranslationId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeReadBibleTranslation(refreshTranslation);
  }, [refreshTranslation]);

  useEffect(() => {
    if (!translationCatalogReady) return;
    return subscribeLocale(() => {
      void syncAutoTranslationForLocale();
    });
  }, [translationCatalogReady, syncAutoTranslationForLocale]);

  const px = useMemo(() => readBibleTypographyPx(typography.size), [typography.size]);
  const sizeAtMin = readBibleSizeAtMin(typography.size);
  const sizeAtMax = readBibleSizeAtMax(typography.size);
  const sizeAtDefault = typography.size === defaultReadBibleTypographyPrefs().size;
  const sizeAtLargePreset = typography.size === READ_BIBLE_SIZE_PRESET_LARGE;

  const bumpSize = useCallback((delta: -1 | 1) => {
    setTypography((prev) => {
      const next = { ...prev, size: stepReadBibleSize(prev.size, delta) };
      if (next.size === prev.size) return prev;
      void writeReadBibleTypographyPrefs(next);
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
          // 主译本变更后恢复「语音跟随主译本」。
          audioTranslationId: null,
        },
        translationIndex,
      );
      await syncHomeVersePrefsFromPrimary(next.primaryTranslationId, { mode: "manual" });
      setTranslation(next);
    },
    [translation, translationIndex, syncHomeVersePrefsFromPrimary],
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
      // Optimistic update so the UI/reader reflects the latest choice immediately.
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
    [translation, translationIndex],
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
    [translation, translationIndex],
  );

  const chapterAudioTranslationId = useMemo(
    () => resolveChapterAudioTranslationId(translation, translationIndex),
    [translation, translationIndex],
  );

  const refreshTranslationCatalog = useCallback(async () => {
    const index = await fetchBibleTranslationsCatalogFresh();
    setTranslationCatalog(index.translations);
    setDefaultTranslationId(index.defaultTranslationId);
    setTranslationCatalogReady(true);
    const locale = getLocale();
    const prefs = await readReadBibleTranslationPrefs(index, locale);
    const normalized = await writeReadBibleTranslationPrefs(prefs, index);
    setTranslation(normalized);
  }, []);

  const value = useMemo(
    (): ReadBibleTypographyContextValue => ({
      typography,
      px,
      verseParagraphFlow: typography.verseParagraphFlow,
      setVerseParagraphFlow,
      chapterSegmentMode:
        typography.chapterSegmentMode === "t1" ? "t1" : "default",
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
