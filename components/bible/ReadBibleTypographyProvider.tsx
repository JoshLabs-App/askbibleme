"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { HOME_BIBLE_TRANSLATIONS_CATALOG_URL } from "@/lib/home-prayer-pools/constants";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import {
  DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS,
  parseReadBibleTypographyPrefs,
  readBibleSizeAtMax,
  readBibleSizeAtMin,
  readBibleTypographyCssVars,
  READ_BIBLE_SIZE_PRESET_LARGE,
  READ_BIBLE_TYPOGRAPHY_STORAGE_KEY,
  readReadBibleTypographyPrefsFromStorage,
  stepReadBibleSize,
  writeReadBibleTypographyPrefsToStorage,
  type ReadBibleSizeId,
  type ReadBibleTypographyPrefsV1,
  type ChapterSegmentMode,
} from "@/lib/read/read-bible-typography-prefs";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { resolveChapterAudioTranslationId } from "@/lib/read/read-chapter-audio-translation";
import {
  readReadBibleTranslationPrefsFromStorage,
  resolveDefaultPrimaryTranslationId,
  writeReadBibleTranslationPrefsToStorage,
  type ReadBibleTranslationPrefsV1,
} from "@/lib/read/read-bible-translation-prefs";
import {
  readHomePrayerVersePrefs,
  requestHomePrayerVerseFeedReload,
  writeHomePrayerVersePrefs,
} from "@/lib/home-prayer-pools/prefs";

type CatalogResponse = {
  version: 1;
  translations: BibleTranslationsIndex["translations"];
  defaultTranslationId: string | null;
};

type ReadBibleReadSettingsContextValue = {
  typography: ReadBibleTypographyPrefsV1;
  setSize: (size: ReadBibleSizeId) => void;
  sizeAtMin: boolean;
  sizeAtMax: boolean;
  sizeAtDefault: boolean;
  bumpSize: (delta: -1 | 1) => void;
  resetSizeToDefault: () => void;
  setSizeToLargePreset: () => void;
  sizeAtLargePreset: boolean;
  setVerseParagraphFlow: (enabled: boolean) => void;
  setChapterSegmentMode: (mode: ChapterSegmentMode) => void;
  translation: ReadBibleTranslationPrefsV1;
  contrastTranslationIds: string[];
  contrastTranslationId: string | null;
  translationCatalog: CatalogResponse["translations"];
  translationCatalogReady: boolean;
  setPrimaryTranslationId: (id: string) => ReadBibleTranslationPrefsV1;
  setContrastTranslationIds: (ids: string[]) => ReadBibleTranslationPrefsV1;
  setContrastTranslationId: (id: string | null) => ReadBibleTranslationPrefsV1;
  setAudioTranslationId: (id: string | null) => ReadBibleTranslationPrefsV1;
  chapterAudioTranslationId: string;
};

export const ReadBibleReadSettingsContext = createContext<ReadBibleReadSettingsContextValue | null>(null);

function applyTypographyToDocument(prefs: ReadBibleTypographyPrefsV1) {
  const root = document.documentElement;
  const vars = readBibleTypographyCssVars(prefs);
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

function clearTypographyFromDocument() {
  const root = document.documentElement;
  for (const k of Object.keys(readBibleTypographyCssVars(DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS))) {
    root.style.removeProperty(k);
  }
}

function catalogToIndex(catalog: CatalogResponse): BibleTranslationsIndex {
  return {
    translations: catalog.translations,
    defaultTranslationId: catalog.defaultTranslationId,
  };
}

export function ReadBibleTypographyProvider({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useLocale();
  const [typography, setTypography] = useState<ReadBibleTypographyPrefsV1>(DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS);
  const [translation, setTranslation] = useState<ReadBibleTranslationPrefsV1 | null>(null);
  const [translationCatalog, setTranslationCatalog] = useState<CatalogResponse["translations"]>([]);
  const [defaultTranslationId, setDefaultTranslationId] = useState<string | null>(null);
  const [translationCatalogReady, setTranslationCatalogReady] = useState(false);

  useLayoutEffect(() => {
    setTypography(readReadBibleTypographyPrefsFromStorage());
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(HOME_BIBLE_TRANSLATIONS_CATALOG_URL, { cache: "force-cache" });
        const data = (await res.json()) as CatalogResponse;
        if (cancelled) return;
        const list = Array.isArray(data.translations) ? data.translations : [];
        setTranslationCatalog(list);
        setDefaultTranslationId(data.defaultTranslationId ?? null);
        const index = catalogToIndex({
          version: 1,
          translations: list,
          defaultTranslationId: data.defaultTranslationId ?? null,
        });
        const fromStorage = readReadBibleTranslationPrefsFromStorage(index, locale);
        writeReadBibleTranslationPrefsToStorage(fromStorage, index);
        setTranslation(fromStorage);
        setTranslationCatalogReady(true);
      } catch {
        if (!cancelled) {
          setTranslationCatalogReady(true);
          setTranslation((prev) =>
            prev ?? {
              version: 1,
              primaryTranslationId: resolveDefaultPrimaryTranslationId(
                { translations: [], defaultTranslationId: null },
                locale,
              ),
              contrastTranslationIds: [],
              audioTranslationId: null,
            },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useLayoutEffect(() => {
    applyTypographyToDocument(typography);
    return () => {
      clearTypographyFromDocument();
    };
  }, [typography]);

  useLayoutEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === READ_BIBLE_TYPOGRAPHY_STORAGE_KEY && e.newValue != null) {
        setTypography(parseReadBibleTypographyPrefs(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSize = useCallback((size: ReadBibleSizeId) => {
    setTypography((p) => {
      const next = { ...p, size };
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const bumpSize = useCallback(
    (delta: -1 | 1) => {
      setTypography((p) => {
        const next = { ...p, size: stepReadBibleSize(p.size, delta) };
        if (next.size === p.size) return p;
        writeReadBibleTypographyPrefsToStorage(next);
        return next;
      });
    },
    [],
  );

  const resetSizeToDefault = useCallback(() => {
    setTypography((p) => {
      const next = { ...p, size: DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS.size };
      if (next.size === p.size) return p;
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const setSizeToLargePreset = useCallback(() => {
    setTypography((p) => {
      const next = { ...p, size: READ_BIBLE_SIZE_PRESET_LARGE };
      if (next.size === p.size) return p;
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const setVerseParagraphFlow = useCallback((enabled: boolean) => {
    setTypography((p) => {
      const next = { ...p, verseParagraphFlow: enabled };
      if (next.verseParagraphFlow === p.verseParagraphFlow) return p;
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const setChapterSegmentMode = useCallback((mode: ChapterSegmentMode) => {
    setTypography((p) => {
      const normalized: ChapterSegmentMode = mode === "t1" ? "t1" : "default";
      const next: ReadBibleTypographyPrefsV1 = { ...p, chapterSegmentMode: normalized };
      if (next.chapterSegmentMode === p.chapterSegmentMode) return p;
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const sizeAtMin = readBibleSizeAtMin(typography.size);
  const sizeAtMax = readBibleSizeAtMax(typography.size);
  const sizeAtDefault = typography.size === DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS.size;
  const sizeAtLargePreset = typography.size === READ_BIBLE_SIZE_PRESET_LARGE;

  const translationIndex = useMemo(
    (): BibleTranslationsIndex => ({
      translations: translationCatalog,
      defaultTranslationId: defaultTranslationId ?? translationCatalog[0]?.id ?? "cuv-simp",
    }),
    [translationCatalog, defaultTranslationId],
  );

  const setPrimaryTranslationId = useCallback(
    (id: string) => {
      const base = translation ?? readReadBibleTranslationPrefsFromStorage(translationIndex, locale);
      const next = writeReadBibleTranslationPrefsToStorage(
        {
          ...base,
          primaryTranslationId: id,
          contrastTranslationIds: base.contrastTranslationIds.filter((item) => item !== id),
        },
        translationIndex,
      );
      setTranslation(next);
      const selected = translationIndex.translations.find((t) => t.id === next.primaryTranslationId);
      const selectedLocale = /^en\b/i.test(selected?.language ?? "")
        ? "en"
        : selected?.id === "cuv-trad" || /hant/i.test(selected?.language ?? "")
          ? "zh-TW"
          : "zh-CN";
      const homePrefs = readHomePrayerVersePrefs();
      if (selectedLocale === "en") {
        if (homePrefs.verseTextEnTranslationId !== next.primaryTranslationId) {
          writeHomePrayerVersePrefs({
            ...homePrefs,
            verseTextEnTranslationId: next.primaryTranslationId,
          });
          requestHomePrayerVerseFeedReload();
        }
      } else if (homePrefs.verseTextZhTranslationId !== next.primaryTranslationId) {
        writeHomePrayerVersePrefs({
          ...homePrefs,
          verseTextZhTranslationId: next.primaryTranslationId,
        });
        requestHomePrayerVerseFeedReload();
      }
      if (locale !== selectedLocale) {
        setLocale(selectedLocale);
      }
      return next;
    },
    [translation, translationIndex, locale, setLocale],
  );

  const setContrastTranslationIds = useCallback(
    (ids: string[]) => {
      const base = translation ?? readReadBibleTranslationPrefsFromStorage(translationIndex, locale);
      const normalized = ids.map((item) => item.trim()).filter(Boolean);
      const next = writeReadBibleTranslationPrefsToStorage(
        {
          ...base,
          contrastTranslationIds: normalized.filter((item) => item !== base.primaryTranslationId),
        },
        translationIndex,
      );
      setTranslation(next);
      return next;
    },
    [translation, translationIndex, locale],
  );

  const setContrastTranslationId = useCallback(
    (id: string | null) => {
      return setContrastTranslationIds(id && id.trim() ? [id.trim()] : []);
    },
    [setContrastTranslationIds],
  );

  const setAudioTranslationId = useCallback(
    (id: string | null) => {
      const base = translation ?? readReadBibleTranslationPrefsFromStorage(translationIndex, locale);
      const next = writeReadBibleTranslationPrefsToStorage(
        { ...base, audioTranslationId: id && id.trim() ? id.trim() : null },
        translationIndex,
      );
      setTranslation(next);
      return next;
    },
    [translation, translationIndex, locale],
  );

  const resolvedTranslation =
    translation ??
    (translationCatalogReady
      ? readReadBibleTranslationPrefsFromStorage(translationIndex, locale)
      : {
          version: 1 as const,
          primaryTranslationId: resolveDefaultPrimaryTranslationId(translationIndex, locale),
          contrastTranslationIds: [],
          audioTranslationId: null,
        });

  const chapterAudioTranslationId = useMemo(
    () => resolveChapterAudioTranslationId(resolvedTranslation, translationIndex),
    [resolvedTranslation, translationIndex],
  );

  const contrastTranslationIds = resolvedTranslation.contrastTranslationIds;
  const contrastTranslationId = contrastTranslationIds[0] ?? null;

  const value = useMemo(
    (): ReadBibleReadSettingsContextValue => ({
      typography,
      setSize,
      sizeAtMin,
      sizeAtMax,
      sizeAtDefault,
      sizeAtLargePreset,
      bumpSize,
      resetSizeToDefault,
      setSizeToLargePreset,
      setVerseParagraphFlow,
      setChapterSegmentMode,
      translation: resolvedTranslation,
      contrastTranslationIds,
      contrastTranslationId,
      translationCatalog,
      translationCatalogReady,
      setPrimaryTranslationId,
      setContrastTranslationIds,
      setContrastTranslationId,
      setAudioTranslationId,
      chapterAudioTranslationId,
    }),
    [
      typography,
      setSize,
      sizeAtMin,
      sizeAtMax,
      sizeAtDefault,
      sizeAtLargePreset,
      bumpSize,
      resetSizeToDefault,
      setSizeToLargePreset,
      setVerseParagraphFlow,
      setChapterSegmentMode,
      resolvedTranslation,
      contrastTranslationIds,
      contrastTranslationId,
      translationCatalog,
      translationCatalogReady,
      setPrimaryTranslationId,
      setContrastTranslationIds,
      setContrastTranslationId,
      setAudioTranslationId,
      chapterAudioTranslationId,
    ],
  );

  return (
    <ReadBibleReadSettingsContext.Provider value={value}>{children}</ReadBibleReadSettingsContext.Provider>
  );
}

export function useReadBibleTypography(): Pick<
  ReadBibleReadSettingsContextValue,
  | "typography"
  | "setSize"
  | "sizeAtMin"
  | "sizeAtMax"
  | "sizeAtDefault"
  | "sizeAtLargePreset"
  | "bumpSize"
  | "resetSizeToDefault"
  | "setSizeToLargePreset"
  | "setVerseParagraphFlow"
  | "setChapterSegmentMode"
> {
  const v = useContext(ReadBibleReadSettingsContext);
  if (!v) throw new Error("useReadBibleTypography must be used under ReadBibleTypographyProvider");
  return {
    typography: v.typography,
    setSize: v.setSize,
    sizeAtMin: v.sizeAtMin,
    sizeAtMax: v.sizeAtMax,
    sizeAtDefault: v.sizeAtDefault,
    sizeAtLargePreset: v.sizeAtLargePreset,
    bumpSize: v.bumpSize,
    resetSizeToDefault: v.resetSizeToDefault,
    setSizeToLargePreset: v.setSizeToLargePreset,
    setVerseParagraphFlow: v.setVerseParagraphFlow,
    setChapterSegmentMode: v.setChapterSegmentMode,
  };
}

export function useReadBibleTranslationSettings(): Pick<
  ReadBibleReadSettingsContextValue,
  | "translation"
  | "contrastTranslationIds"
  | "contrastTranslationId"
  | "translationCatalog"
  | "translationCatalogReady"
  | "setPrimaryTranslationId"
  | "setContrastTranslationIds"
  | "setContrastTranslationId"
  | "setAudioTranslationId"
  | "chapterAudioTranslationId"
> {
  const v = useContext(ReadBibleReadSettingsContext);
  if (!v) throw new Error("useReadBibleTranslationSettings must be used under ReadBibleTypographyProvider");
  return {
    translation: v.translation,
    contrastTranslationIds: v.contrastTranslationIds,
    contrastTranslationId: v.contrastTranslationId,
    translationCatalog: v.translationCatalog,
    translationCatalogReady: v.translationCatalogReady,
    setPrimaryTranslationId: v.setPrimaryTranslationId,
    setContrastTranslationIds: v.setContrastTranslationIds,
    setContrastTranslationId: v.setContrastTranslationId,
    setAudioTranslationId: v.setAudioTranslationId,
    chapterAudioTranslationId: v.chapterAudioTranslationId,
  };
}
