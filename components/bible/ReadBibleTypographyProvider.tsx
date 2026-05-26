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
  READ_BIBLE_TYPOGRAPHY_STORAGE_KEY,
  readReadBibleTypographyPrefsFromStorage,
  stepReadBibleSize,
  writeReadBibleTypographyPrefsToStorage,
  type ReadBibleSizeId,
  type ReadBibleTypographyPrefsV1,
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
  translation: ReadBibleTranslationPrefsV1;
  translationCatalog: CatalogResponse["translations"];
  translationCatalogReady: boolean;
  setPrimaryTranslationId: (id: string) => ReadBibleTranslationPrefsV1;
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
              contrastTranslationId: null,
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
      const next = { size };
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const bumpSize = useCallback(
    (delta: -1 | 1) => {
      setTypography((p) => {
        const next = { size: stepReadBibleSize(p.size, delta) };
        if (next.size === p.size) return p;
        writeReadBibleTypographyPrefsToStorage(next);
        return next;
      });
    },
    [],
  );

  const resetSizeToDefault = useCallback(() => {
    setTypography((p) => {
      const next = { ...DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS };
      if (next.size === p.size) return p;
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const sizeAtMin = readBibleSizeAtMin(typography.size);
  const sizeAtMax = readBibleSizeAtMax(typography.size);
  const sizeAtDefault = typography.size === DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS.size;

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
          contrastTranslationId:
            base.contrastTranslationId === id ? null : base.contrastTranslationId,
        },
        translationIndex,
      );
      setTranslation(next);
      const selected = translationIndex.translations.find((t) => t.id === next.primaryTranslationId);
      const selectedLocale = /^en\b/i.test(selected?.language ?? "") ? "en" : "zh-CN";
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

  const setContrastTranslationId = useCallback(
    (id: string | null) => {
      const base = translation ?? readReadBibleTranslationPrefsFromStorage(translationIndex, locale);
      const next = writeReadBibleTranslationPrefsToStorage(
        { ...base, contrastTranslationId: id && id.trim() ? id.trim() : null },
        translationIndex,
      );
      setTranslation(next);
      return next;
    },
    [translation, translationIndex, locale],
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
          contrastTranslationId: null,
          audioTranslationId: null,
        });

  const chapterAudioTranslationId = useMemo(
    () => resolveChapterAudioTranslationId(resolvedTranslation),
    [resolvedTranslation],
  );

  const value = useMemo(
    (): ReadBibleReadSettingsContextValue => ({
      typography,
      setSize,
      sizeAtMin,
      sizeAtMax,
      sizeAtDefault,
      bumpSize,
      resetSizeToDefault,
      translation: resolvedTranslation,
      translationCatalog,
      translationCatalogReady,
      setPrimaryTranslationId,
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
      bumpSize,
      resetSizeToDefault,
      resolvedTranslation,
      translationCatalog,
      translationCatalogReady,
      setPrimaryTranslationId,
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
  | "bumpSize"
  | "resetSizeToDefault"
> {
  const v = useContext(ReadBibleReadSettingsContext);
  if (!v) throw new Error("useReadBibleTypography must be used under ReadBibleTypographyProvider");
  return {
    typography: v.typography,
    setSize: v.setSize,
    sizeAtMin: v.sizeAtMin,
    sizeAtMax: v.sizeAtMax,
    sizeAtDefault: v.sizeAtDefault,
    bumpSize: v.bumpSize,
    resetSizeToDefault: v.resetSizeToDefault,
  };
}

export function useReadBibleTranslationSettings(): Pick<
  ReadBibleReadSettingsContextValue,
  | "translation"
  | "translationCatalog"
  | "translationCatalogReady"
  | "setPrimaryTranslationId"
  | "setContrastTranslationId"
  | "setAudioTranslationId"
  | "chapterAudioTranslationId"
> {
  const v = useContext(ReadBibleReadSettingsContext);
  if (!v) throw new Error("useReadBibleTranslationSettings must be used under ReadBibleTypographyProvider");
  return {
    translation: v.translation,
    translationCatalog: v.translationCatalog,
    translationCatalogReady: v.translationCatalogReady,
    setPrimaryTranslationId: v.setPrimaryTranslationId,
    setContrastTranslationId: v.setContrastTranslationId,
    setAudioTranslationId: v.setAudioTranslationId,
    chapterAudioTranslationId: v.chapterAudioTranslationId,
  };
}
