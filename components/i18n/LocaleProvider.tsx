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
import {
  DEFAULT_LOCALE,
  inferAppLocaleFromNavigator,
  LOCALE_STORAGE_KEY,
  persistLocaleToCookie,
  parseLocale,
  type AppLocale,
} from "@/lib/i18n/config";
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

function createGetLocaleSnapshot(initialLocaleGuess: AppLocale) {
  return function getLocaleSnapshot(): AppLocale {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    try {
      const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (raw) return parseLocale(raw);
      return initialLocaleGuess;
    } catch {
      return DEFAULT_LOCALE;
    }
  };
}

function createGetServerSnapshot(initialLocaleGuess: AppLocale) {
  return function getLocaleServerSnapshot(): AppLocale {
    return initialLocaleGuess;
  };
}

type LocaleProviderProps = {
  children: ReactNode;
  /** 无本地存储时用于 SSR 与首次客户端快照对齐：来自 Cookie 或 `Accept-Language` */
  initialLocaleGuess: AppLocale;
};

export function LocaleProvider({ children, initialLocaleGuess }: LocaleProviderProps) {
  const getSnapshot = useMemo(() => createGetLocaleSnapshot(initialLocaleGuess), [initialLocaleGuess]);
  const getServerSnapshot = useMemo(() => createGetServerSnapshot(initialLocaleGuess), [initialLocaleGuess]);

  const locale = useSyncExternalStore(subscribeLocale, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    persistLocaleToCookie(next);
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    emitLocaleChange();
  }, []);

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (!raw) {
        setLocale(inferAppLocaleFromNavigator());
        return;
      }
      persistLocaleToCookie(parseLocale(raw));
    } catch {
      /* ignore */
    }
  }, [setLocale]);

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
