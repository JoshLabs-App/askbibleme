"use client";

import type { ReactNode } from "react";

type Props = { children: ReactNode };

/**
 * 前台 fixed 壳：与品牌 `canvas`（深青）一致。
 * 使用 `inset-0` 顶对齐视口，勿负 top / `transform-gpu` 抬壳，否则壳内 `position:fixed`（如侧栏菜单）会相对错位、顶内容被裁切。
 */
export function AppShellFixedChrome({ children }: Props) {
  const safeFill = { backgroundColor: "rgb(var(--brand-app-dark-rgb))" } as const;
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
      {/* 留海 / 圆角屏四边：与内层主壳同色铺满，避免半透状态栏或横条外露浅缝 */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 z-0"
        style={{ ...safeFill, height: "env(safe-area-inset-top, 0px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-0"
        style={{ ...safeFill, height: "env(safe-area-inset-bottom, 0px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-0"
        style={{ ...safeFill, width: "env(safe-area-inset-left, 0px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 top-0 z-0"
        style={{ ...safeFill, width: "env(safe-area-inset-right, 0px)" }}
      />
      {/* 与底栏 `appDark` 一致：子像素缝透出时仍是同色，避免细缝露外层 `canvas` 呈浅色线 */}
      <div className="relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-visible bg-appDark">
        {children}
      </div>
    </div>
  );
}
