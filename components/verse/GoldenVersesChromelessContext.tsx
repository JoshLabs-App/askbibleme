"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";

type GoldenVersesChromelessContextValue = {
  /** 隐藏顶栏、底栏、壳层上下渐变，主区占满可视高 */
  chromeless: boolean;
  /** 用户显式进入沉浸（竖屏点经文 / 点全屏钮）；横屏窄窗另有自动沉浸 */
  manualChromeless: boolean;
  landscapeNarrow: boolean;
  setManualChromeless: (next: boolean) => void;
  toggleManualChromeless: () => void;
};

const GoldenVersesChromelessContext = createContext<GoldenVersesChromelessContextValue | null>(null);

export function useGoldenVersesChromeless(): GoldenVersesChromelessContextValue {
  const v = useContext(GoldenVersesChromelessContext);
  if (!v) {
    throw new Error("useGoldenVersesChromeless must be used under GoldenVersesChromelessProvider");
  }
  return v;
}

export function GoldenVersesChromelessProvider({ children }: { children: ReactNode }) {
  const landscapeNarrow = useLandscapeNarrow();
  const [manualChromeless, setManualChromeless] = useState(false);

  const chromeless = manualChromeless || landscapeNarrow;

  useEffect(() => {
    if (!chromeless) {
      document.documentElement.removeAttribute("data-golden-verses-chromeless");
      return;
    }
    document.documentElement.setAttribute("data-golden-verses-chromeless", "");
    return () => document.documentElement.removeAttribute("data-golden-verses-chromeless");
  }, [chromeless]);

  /** 与 `NatureVideoExperience` 一致：非 iOS 的「手机式横屏」尝试系统全屏；竖屏或离开横屏时退出 */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isIosLikeUserAgent()) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    if (!landscapeNarrow) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    void requestFullscreenCompat(document.documentElement).catch(() => {});
  }, [landscapeNarrow]);

  useEffect(() => {
    if (!chromeless) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setManualChromeless(false);
        void exitFullscreenCompat();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [chromeless]);

  const toggleManualChromeless = useCallback(() => {
    setManualChromeless((m) => !m);
  }, []);

  const value = useMemo(
    () => ({
      chromeless,
      manualChromeless,
      landscapeNarrow,
      setManualChromeless,
      toggleManualChromeless,
    }),
    [chromeless, manualChromeless, landscapeNarrow, toggleManualChromeless],
  );

  return <GoldenVersesChromelessContext.Provider value={value}>{children}</GoldenVersesChromelessContext.Provider>;
}
