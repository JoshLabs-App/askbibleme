"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
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

const localeListeners = new Set<() => void>();

function emitLocaleChange() {
  localeListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function subscribeLocale(onStore: () => void) {
  if (typeof window === "undefined") return () => {};
  localeListeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCALE_STORAGE_KEY || e.key === null) onStore();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    localeListeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
}

function getLocaleSnapshot(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
}

function getLocaleServerSnapshot(): AppLocale {
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleServerSnapshot);

  useLayoutEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    emitLocaleChange();
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
