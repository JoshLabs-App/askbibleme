"use client";

import { useLayoutEffect } from "react";
import { NATURE_HOME_THEME_LOCK_DATASET_KEY } from "@/lib/nature/root-theme";
import { measureAppShellSafeTopPx } from "@/lib/read/measure-app-shell-safe-top";
import { isSamsungGalaxyUa } from "@/lib/read/parchment-samsung-device";
import {
  SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_KEY,
  SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_VALUE,
  SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR,
  SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE,
  SCRIPTURE_PARCHMENT_THEME_COLOR,
  SCRIPTURE_PARCHMENT_THEME_COLOR_DARK,
  SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE,
  scriptureParchmentStatusBarTheme,
} from "@/lib/read/scripture-parchment-shell";

function syncSafeTopEffective() {
  const root = document.documentElement;
  const topPx = measureAppShellSafeTopPx();
  if (topPx > 0) {
    root.style.setProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR, `${topPx}px`);
    root.style.setProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR, `${topPx}px`);
    return;
  }
  root.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR);
  root.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR);
}

function syncParchmentThemeColor() {
  const root = document.documentElement;
  const dark = root.classList.contains("dark");
  const samsung = isSamsungGalaxyUa();
  const canvas = dark ? SCRIPTURE_PARCHMENT_THEME_COLOR_DARK : SCRIPTURE_PARCHMENT_THEME_COLOR;
  const statusBar = scriptureParchmentStatusBarTheme(dark, samsung);

  if (samsung) {
    root.dataset[SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_KEY] = SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_VALUE;
  } else {
    Reflect.deleteProperty(root.dataset, SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_KEY);
  }

  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", statusBar);
  }
  root.style.backgroundColor = canvas;
  document.body.style.backgroundColor = canvas;
}

/**
 * 读经 / 祷告羊皮卷：透明顶栏 + 全屏羊皮底（状态栏下延续同一张底图）。
 */
export function ScriptureParchmentShellChromeEffect() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.dataset[SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY] = SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE;
    html.dataset[NATURE_HOME_THEME_LOCK_DATASET_KEY] = SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE;

    syncSafeTopEffective();
    syncParchmentThemeColor();

    const onViewport = () => syncSafeTopEffective();
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    window.addEventListener("resize", onViewport);

    const darkObs = new MutationObserver(() => syncParchmentThemeColor());
    darkObs.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
      window.removeEventListener("resize", onViewport);
      darkObs.disconnect();
      Reflect.deleteProperty(html.dataset, SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY);
      Reflect.deleteProperty(html.dataset, SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_KEY);
      Reflect.deleteProperty(html.dataset, NATURE_HOME_THEME_LOCK_DATASET_KEY);
      html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR);
      html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR);
      html.style.removeProperty("background-color");
      document.body.style.removeProperty("background-color");
    };
  }, []);

  return null;
}
