import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { type AppLocale } from "./config";
import { getLocale, hydrateLocaleFromStorage, setLocale as persistLocale, subscribeLocale } from "./locale-store";
import { createT, type SiteCopyVars } from "./site-copy";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (path: string, vars?: SiteCopyVars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

type Props = {
  children: ReactNode;
};

export function LocaleProvider({ children }: Props) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE_FALLBACK);

  useEffect(() => {
    void hydrateLocaleFromStorage();
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    void persistLocale(next);
  }, []);

  const t = useMemo(() => createT(locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {/* 切换语言时整树重挂载，使直接 import `t` 的组件也能拿到新文案 */}
      <LocaleSubtree key={locale}>{children}</LocaleSubtree>
    </LocaleContext.Provider>
  );
}

const DEFAULT_LOCALE_FALLBACK = getLocale();

function LocaleSubtree({ children }: { children: ReactNode }) {
  return children;
}

export function useLocale(): LocaleContextValue {
  const v = useContext(LocaleContext);
  if (!v) throw new Error("useLocale must be used within LocaleProvider");
  return v;
}
