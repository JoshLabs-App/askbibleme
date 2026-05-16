"use client";

import { useLayoutEffect } from "react";
import {
  NATURE_HOME_THEME_LOCK_DATASET_KEY,
} from "@/lib/nature/root-theme";
import {
  SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR,
  SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE,
  SCRIPTURE_PARCHMENT_THEME_COLOR,
  SCRIPTURE_PARCHMENT_THEME_COLOR_DARK,
  SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE,
} from "@/lib/read/scripture-parchment-shell";

function readSafeAreaInsetTopPx(): number {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;height:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);";
  document.documentElement.appendChild(probe);
  const inset = probe.getBoundingClientRect().height;
  probe.remove();
  return inset;
}

function syncAndroidSafeTopFallback() {
  const root = document.documentElement;
  const envTop = readSafeAreaInsetTopPx();
  if (envTop > 0) {
    root.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR);
    root.style.setProperty(
      SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR,
      "env(safe-area-inset-top, 0px)",
    );
    return;
  }
  const vv = window.visualViewport;
  const fallback = Math.max(0, Math.round(vv?.offsetTop ?? 0));
  root.style.setProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR, `${fallback}px`);
  root.style.setProperty(
    SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR,
    `max(env(safe-area-inset-top, 0px), var(${SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR}, 0px))`,
  );
}

function syncParchmentThemeColor() {
  const dark = document.documentElement.classList.contains("dark");
  const color = dark ? SCRIPTURE_PARCHMENT_THEME_COLOR_DARK : SCRIPTURE_PARCHMENT_THEME_COLOR;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", color);
  }
  document.documentElement.style.backgroundColor = color;
}

/**
 * 读经 / 祷告羊皮卷：刘海与安全区铺底图；Android 顶栏 `theme-color` 与卷轴暖色对齐。
 */
export function ScriptureParchmentShellChromeEffect() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.dataset[SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY] = SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE;
    html.dataset[NATURE_HOME_THEME_LOCK_DATASET_KEY] = SCRIPTURE_PARCHMENT_THEME_LOCK_VALUE;

    syncAndroidSafeTopFallback();
    syncParchmentThemeColor();

    const onViewport = () => syncAndroidSafeTopFallback();
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
      Reflect.deleteProperty(html.dataset, NATURE_HOME_THEME_LOCK_DATASET_KEY);
      html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR);
      html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR);
      html.style.removeProperty("background-color");
    };
  }, []);

  return null;
}
