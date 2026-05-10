"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, parseLocale, type AppLocale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { translate } from "@/lib/i18n/translate";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (path: string, vars?: Record<string, string>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);

  useLayoutEffect(() => {
    const saved = parseLocale(
      typeof window !== "undefined" ? localStorage.getItem(LOCALE_STORAGE_KEY) : null,
    );
    setLocaleState(saved);
    document.documentElement.lang = saved === "en" ? "en" : "zh-CN";
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (path: string, vars?: Record<string, string>) => translate(MESSAGES[locale], path, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const v = useContext(LocaleContext);
  if (!v) throw new Error("useLocale must be used within LocaleProvider");
  return v;
}
