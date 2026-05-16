"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isScenesShellPath, SCENES_PAGE_SURFACE_STYLE } from "@/lib/nature/scenes-page-surface";

type Props = { children: ReactNode };

/**
 * 前台 fixed 壳：与品牌 `canvas`（深青）一致。
 * 使用 `inset-0` 顶对齐视口，勿负 top / `transform-gpu` 抬壳，否则壳内 `position:fixed`（如侧栏菜单）会相对错位、顶内容被裁切。
 */
export function AppShellFixedChrome({ children }: Props) {
  const pathname = usePathname() ?? "";
  const scenesSurface = isScenesShellPath(pathname);
  const safeFill = scenesSurface
    ? SCENES_PAGE_SURFACE_STYLE
    : ({ backgroundColor: "rgb(var(--brand-app-dark-rgb))" } as const);
  const safeAreaClass =
    "app-shell-safe-area-fill pointer-events-none absolute z-0 bg-[rgb(var(--brand-app-dark-rgb))]";
  return (
    <div
      className="fixed inset-0 z-[1] flex w-full flex-col overflow-x-hidden overflow-y-visible bg-canvas isolate"
      style={{
        /**
         * 须用 **动态** 视口高，勿单用 `lvh`：`lvh` 为地址栏收起后的「最大」高，首屏带 chrome 时
         * 壳 `min-height` 会高于实际可视区，flex 底栏被顶到屏外（iOS / Android 常见只露底栏一小条）。
         * `max(100dvh, 100svh)`：Android 上 `100dvh` 偶发小于可见区时，用 `svh` 抬高下限，减少顶缘露底。
         */
        minHeight: "max(100dvh, 100svh)",
      }}
    >
      {/* 留海 / 圆角屏四边：默认品牌深色；读经/祷告羊皮卷见 `read-parchment-shell-chrome.css` */}
      <div
        aria-hidden
        className={`${safeAreaClass} app-shell-safe-area-fill--top left-0 right-0 top-0`}
        style={{ ...safeFill, height: "env(safe-area-inset-top, 0px)" }}
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
        className={`app-shell-fixed-chrome-inner relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-visible${scenesSurface ? "" : " bg-appDark"}`}
        style={scenesSurface ? SCENES_PAGE_SURFACE_STYLE : undefined}
      >
        {children}
      </div>
    </div>
  );
}
