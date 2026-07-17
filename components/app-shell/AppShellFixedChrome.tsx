"use client";

import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { isScenesShellPath, SCENES_PAGE_SURFACE_STYLE } from "@/lib/nature/scenes-page-surface";
import { measureAppShellSafeTopPx } from "@/lib/read/measure-app-shell-safe-top";
import { PARCHMENT_SHELL_SURFACE_STYLE } from "@/lib/read/parchment-shell-surface-style";
import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import {
  clearReadParchmentWideDataset,
  subscribeReadParchmentWideViewport,
  syncReadParchmentWideDataset,
} from "@/lib/read/sync-read-parchment-wide";
import {
  isScriptureParchmentPath,
  SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR,
  SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE,
} from "@/lib/read/scripture-parchment-shell";

type Props = { children: ReactNode };

function syncParchmentShellDataset(active: boolean) {
  const html = document.documentElement;
  if (active) {
    html.dataset[SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY] = SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE;
    syncReadParchmentWideDataset(html);
    const topPx = measureAppShellSafeTopPx();
    if (topPx > 0) {
      html.style.setProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR, `${topPx}px`);
      html.style.setProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR, `${topPx}px`);
    } else {
      html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR);
      html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR);
    }
  } else {
    Reflect.deleteProperty(html.dataset, SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY);
    clearReadParchmentWideDataset(html);
    html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_FALLBACK_VAR);
    html.style.removeProperty(SCRIPTURE_PARCHMENT_SAFE_TOP_EFFECTIVE_VAR);
  }
}

/**
 * 前台 fixed 壳：与品牌 `canvas`（默认读经羊皮）一致；读经/祷告路由由羊皮卷 dataset 覆盖。
 * 使用 `inset-0` 顶对齐视口，勿负 top / `transform-gpu` 抬壳，否则壳内 `position:fixed`（如侧栏菜单）会相对错位、顶内容被裁切。
 */
export function AppShellFixedChrome({ children }: Props) {
  const pathname = usePathname() ?? "";
  const scenesSurface = isScenesShellPath(pathname);
  const parchmentShell = isScriptureParchmentPath(pathname);
  const safeFill = scenesSurface
    ? SCENES_PAGE_SURFACE_STYLE
    : ({ backgroundColor: "rgb(var(--brand-app-dark-rgb))" } as const);
  const safeAreaClass = parchmentShell
    ? "app-shell-safe-area-fill pointer-events-none absolute z-[2]"
    : "app-shell-safe-area-fill pointer-events-none absolute z-0 bg-[rgb(var(--brand-app-dark-rgb))]";

  useLayoutEffect(() => {
    syncParchmentShellDataset(parchmentShell);
    if (!parchmentShell) return;
    const onViewport = () => syncParchmentShellDataset(true);
    const offWide = subscribeReadParchmentWideViewport(onViewport);
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    window.addEventListener("resize", onViewport);
    return () => {
      offWide();
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
      window.removeEventListener("resize", onViewport);
    };
  }, [parchmentShell]);

  return (
    <div
      className={[
        "app-shell-fixed-chrome-outer fixed inset-0 z-[1] flex w-full flex-col overflow-x-hidden overflow-y-visible isolate",
        parchmentShell || scenesSurface ? "" : "bg-canvas",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        /**
         * 须用 **动态** 视口高，勿单用 `lvh`：`lvh` 为地址栏收起后的「最大」高，首屏带 chrome 时
         * 壳 `min-height` 会高于实际可视区，flex 底栏被顶到屏外（iOS / Android 常见只露底栏一小条）。
         * `max(100dvh, 100svh)`：Android 上 `100dvh` 偶发小于可见区时，用 `svh` 抬高下限，减少顶缘露底。
         */
        minHeight: "max(100dvh, 100svh)",
      }}
    >
      {parchmentShell ? (
        <div aria-hidden className="app-shell-parchment-backdrop pointer-events-none absolute inset-0 z-0" />
      ) : null}
      {/* 留海 / 圆角屏四边：默认品牌深色；读经/祷告羊皮卷见 `read-parchment-shell-chrome.css` */}
      <div
        aria-hidden
        className={`${safeAreaClass} app-shell-safe-area-fill--top left-0 right-0 top-0`}
        style={
          parchmentShell
            ? PARCHMENT_SHELL_SURFACE_STYLE
            : { ...safeFill, height: "env(safe-area-inset-top, 0px)" }
        }
      />
      <div
        aria-hidden
        className={`${safeAreaClass} bottom-0 left-0 right-0`}
        style={{ ...safeFill, height: "env(safe-area-inset-bottom, 0px)" }}
      />
      <div
        aria-hidden
        className={`${safeAreaClass} bottom-0 left-0 top-0`}
        style={{ ...safeFill, width: "env(safe-area-inset-left, 0px)" }}
      />
      <div
        aria-hidden
        className={`${safeAreaClass} bottom-0 right-0 top-0`}
        style={{ ...safeFill, width: "env(safe-area-inset-right, 0px)" }}
      />
      {/* 与底栏 `appDark` 一致：子像素缝透出时仍是同色，避免细缝露外层 `canvas` 呈浅色线 */}
      <div
        className={`app-shell-fixed-chrome-inner relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-visible${scenesSurface || parchmentShell ? "" : " bg-appDark"}`}
        style={scenesSurface ? SCENES_PAGE_SURFACE_STYLE : parchmentShell ? { backgroundColor: "transparent" } : undefined}
      >
        {children}
      </div>
      <HomeBottomNav />
    </div>
  );
}
