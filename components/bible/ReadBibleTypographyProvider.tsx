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
import {
  readReadBibleTranslationPrefsFromStorage,
  writeReadBibleTranslationPrefsToStorage,
  type ReadBibleTranslationPrefsV1,
} from "@/lib/read/read-bible-translation-prefs";

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
  bumpSize: (delta: -1 | 1) => void;
  translation: ReadBibleTranslationPrefsV1;
  translationCatalog: CatalogResponse["translations"];
  translationCatalogReady: boolean;
  setPrimaryTranslationId: (id: string) => ReadBibleTranslationPrefsV1;
  setContrastTranslationId: (id: string | null) => ReadBibleTranslationPrefsV1;
};

const ReadBibleReadSettingsContext = createContext<ReadBibleReadSettingsContextValue | null>(null);

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
        const fromStorage = readReadBibleTranslationPrefsFromStorage(index);
        writeReadBibleTranslationPrefsToStorage(fromStorage, index);
        setTranslation(fromStorage);
        setTranslationCatalogReady(true);
      } catch {
        if (!cancelled) {
          setTranslationCatalogReady(true);
          setTranslation((prev) => prev ?? { version: 1, primaryTranslationId: "cuv-simp", contrastTranslationId: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const sizeAtMin = readBibleSizeAtMin(typography.size);
  const sizeAtMax = readBibleSizeAtMax(typography.size);

  const translationIndex = useMemo(
    (): BibleTranslationsIndex => ({
      translations: translationCatalog,
      defaultTranslationId: defaultTranslationId ?? translationCatalog[0]?.id ?? "cuv-simp",
    }),
    [translationCatalog, defaultTranslationId],
  );

  const setPrimaryTranslationId = useCallback(
    (id: string) => {
      const base = translation ?? readReadBibleTranslationPrefsFromStorage(translationIndex);
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
      return next;
    },
    [translation, translationIndex],
  );

  const setContrastTranslationId = useCallback(
    (id: string | null) => {
      const base = translation ?? readReadBibleTranslationPrefsFromStorage(translationIndex);
      const next = writeReadBibleTranslationPrefsToStorage(
        { ...base, contrastTranslationId: id && id.trim() ? id.trim() : null },
        translationIndex,
      );
      setTranslation(next);
      return next;
    },
    [translation, translationIndex],
  );

  const resolvedTranslation =
    translation ??
    (translationCatalogReady
      ? readReadBibleTranslationPrefsFromStorage(translationIndex)
      : { version: 1 as const, primaryTranslationId: "cuv-simp", contrastTranslationId: null });

  const value = useMemo(
    (): ReadBibleReadSettingsContextValue => ({
      typography,
      setSize,
      sizeAtMin,
      sizeAtMax,
      bumpSize,
      translation: resolvedTranslation,
      translationCatalog,
      translationCatalogReady,
      setPrimaryTranslationId,
      setContrastTranslationId,
    }),
    [
      typography,
      setSize,
      sizeAtMin,
      sizeAtMax,
      bumpSize,
      resolvedTranslation,
      translationCatalog,
      translationCatalogReady,
      setPrimaryTranslationId,
      setContrastTranslationId,
    ],
  );

  return (
    <ReadBibleReadSettingsContext.Provider value={value}>{children}</ReadBibleReadSettingsContext.Provider>
  );
}

export function useReadBibleTypography(): Pick<
  ReadBibleReadSettingsContextValue,
  "typography" | "setSize" | "sizeAtMin" | "sizeAtMax" | "bumpSize"
> {
  const v = useContext(ReadBibleReadSettingsContext);
  if (!v) throw new Error("useReadBibleTypography must be used under ReadBibleTypographyProvider");
  return {
    typography: v.typography,
    setSize: v.setSize,
    sizeAtMin: v.sizeAtMin,
    sizeAtMax: v.sizeAtMax,
    bumpSize: v.bumpSize,
  };
}

export function useReadBibleTranslationSettings(): Pick<
  ReadBibleReadSettingsContextValue,
  | "translation"
  | "translationCatalog"
  | "translationCatalogReady"
  | "setPrimaryTranslationId"
  | "setContrastTranslationId"
> {
  const v = useContext(ReadBibleReadSettingsContext);
  if (!v) throw new Error("useReadBibleTranslationSettings must be used under ReadBibleTypographyProvider");
  return {
    translation: v.translation,
    translationCatalog: v.translationCatalog,
    translationCatalogReady: v.translationCatalogReady,
    setPrimaryTranslationId: v.setPrimaryTranslationId,
    setContrastTranslationId: v.setContrastTranslationId,
  };
}
