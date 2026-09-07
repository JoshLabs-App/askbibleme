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
  LOCALE_SYNC_EVENT,
  persistLocaleToCookie,
  parseLocale,
  readLocaleCookieClient,
  type AppLocale,
} from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { translate } from "@/lib/i18n/translate";
import { toZhTwText, zhTwOverrideForKey } from "@/lib/i18n/zh-tw-text";

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
  window.addEventListener(LOCALE_SYNC_EVENT, onStore);
  return () => {
    localeListeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCALE_SYNC_EVENT, onStore);
  };
}

function createGetLocaleSnapshot(initialLocaleGuess: AppLocale) {
  return function getLocaleSnapshot(): AppLocale {
    // 与 `getServerSnapshot` 对齐：避免在无 `window` 的路径里回落到 `DEFAULT_LOCALE` 而与首猜不一致
    if (typeof window === "undefined") return initialLocaleGuess;
    try {
      const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (raw) return parseLocale(raw);
    } catch {
      /* 存储不可用时继续往下猜 */
    }
    /**
     * 页面静态生成后服务端读不到请求，语言判定整条链落到客户端：
     * localStorage（用户选过） → cookie（跨标签页 / 存储被清） → 浏览器语言。
     * 与原先服务端 `resolveRequestLocale` 的优先级一致，只是 Accept-Language 换成
     * 等价的 `navigator.languages`。
     */
    return readLocaleCookieClient() ?? inferAppLocaleFromNavigator();
  };
}

function createGetServerSnapshot(initialLocaleGuess: AppLocale) {
  return function getLocaleServerSnapshot(): AppLocale {
    return initialLocaleGuess;
  };
}

type LocaleProviderProps = {
  children: ReactNode;
  /**
   * SSR 与首次客户端快照的对齐值。页面静态生成后服务端已无请求上下文，故默认
   * `DEFAULT_LOCALE`——真正的判定在 `getLocaleSnapshot` 里于客户端完成
   * （localStorage → cookie → navigator）。仍保留此参数，便于将来某个页面若需回到
   * 动态渲染时把首猜传进来。
   */
  initialLocaleGuess?: AppLocale;
};

export function LocaleProvider({
  children,
  initialLocaleGuess = DEFAULT_LOCALE,
}: LocaleProviderProps) {
  const getSnapshot = useMemo(() => createGetLocaleSnapshot(initialLocaleGuess), [initialLocaleGuess]);
  const getServerSnapshot = useMemo(() => createGetServerSnapshot(initialLocaleGuess), [initialLocaleGuess]);

  const locale = useSyncExternalStore(subscribeLocale, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    document.documentElement.lang =
      locale === "en" ? "en" : locale === "zh-TW" ? "zh-Hant" : "zh-CN";
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    persistLocaleToCookie(next);
    document.documentElement.lang =
      next === "en" ? "en" : next === "zh-TW" ? "zh-Hant" : "zh-CN";
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
    (path: string, vars?: Record<string, string>) => {
      if (locale === "zh-TW") {
        const override = zhTwOverrideForKey(path);
        if (override) {
          let s = override;
          if (vars) {
            for (const [k, v] of Object.entries(vars)) {
              s = s.replaceAll(`{{${k}}}`, v);
            }
          }
          return s;
        }
      }
      const primary = MESSAGES[locale];
      const fallbacks =
        locale === "en"
          ? [MESSAGES["zh-CN"]]
          : locale === "zh-TW"
            ? [MESSAGES["zh-CN"], MESSAGES.en]
            : [MESSAGES.en];
      let s = translate(primary, path, vars, fallbacks);
      if (locale === "zh-TW") s = toZhTwText(s);
      return s;
    },
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
