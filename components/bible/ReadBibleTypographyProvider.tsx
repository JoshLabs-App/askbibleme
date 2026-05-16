"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS,
  parseReadBibleTypographyPrefs,
  readBibleTypographyCssVars,
  READ_BIBLE_TYPOGRAPHY_STORAGE_KEY,
  readReadBibleTypographyPrefsFromStorage,
  writeReadBibleTypographyPrefsToStorage,
  type ReadBibleFontId,
  type ReadBibleSizeId,
  type ReadBibleTypographyPrefsV1,
} from "@/lib/read/read-bible-typography-prefs";

type ReadBibleTypographyContextValue = {
  prefs: ReadBibleTypographyPrefsV1;
  setFont: (font: ReadBibleFontId) => void;
  setSize: (size: ReadBibleSizeId) => void;
};

const ReadBibleTypographyContext = createContext<ReadBibleTypographyContextValue | null>(null);

function applyPrefsToDocument(prefs: ReadBibleTypographyPrefsV1) {
  const root = document.documentElement;
  const vars = readBibleTypographyCssVars(prefs);
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

function clearPrefsFromDocument() {
  const root = document.documentElement;
  for (const k of Object.keys(readBibleTypographyCssVars(DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS))) {
    root.style.removeProperty(k);
  }
}

export function ReadBibleTypographyProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<ReadBibleTypographyPrefsV1>(DEFAULT_READ_BIBLE_TYPOGRAPHY_PREFS);

  useLayoutEffect(() => {
    setPrefsState(readReadBibleTypographyPrefsFromStorage());
  }, []);

  useLayoutEffect(() => {
    applyPrefsToDocument(prefs);
    return () => {
      clearPrefsFromDocument();
    };
  }, [prefs]);

  useLayoutEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== READ_BIBLE_TYPOGRAPHY_STORAGE_KEY || e.newValue == null) return;
      setPrefsState(parseReadBibleTypographyPrefs(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setFont = useCallback((font: ReadBibleFontId) => {
    setPrefsState((p) => {
      const next = { ...p, font };
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const setSize = useCallback((size: ReadBibleSizeId) => {
    setPrefsState((p) => {
      const next = { ...p, size };
      writeReadBibleTypographyPrefsToStorage(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, setFont, setSize }), [prefs, setFont, setSize]);

  return <ReadBibleTypographyContext.Provider value={value}>{children}</ReadBibleTypographyContext.Provider>;
}

export function useReadBibleTypography(): ReadBibleTypographyContextValue {
  const v = useContext(ReadBibleTypographyContext);
  if (!v) throw new Error("useReadBibleTypography must be used under ReadBibleTypographyProvider");
  return v;
}
