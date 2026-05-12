"use client";

import type { ReactNode } from "react";

type Props = { children: ReactNode };

/** 前台 fixed 壳：与品牌 `canvas`（深青）一致，避免自然页与其它路由底色分叉导致顶缘露缝。 */
export function AppShellFixedChrome({ children }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-[1] flex min-h-0 w-full flex-col overflow-hidden bg-canvas isolate before:pointer-events-none before:absolute before:inset-x-0 before:top-[calc(-1*var(--app-viewport-bleed-top)-10px)] before:z-0 before:h-[calc(var(--app-viewport-bleed-top)+12px)] before:bg-canvas transform-gpu"
      style={{
        /**
         * 须用 **动态** 视口高，勿用 `lvh`：`lvh` 为地址栏收起后的「最大」高，首屏带 chrome 时
         * 壳 `min-height` 会高于实际可视区，flex 底栏被顶到屏外（iOS / Android 常见只露底栏一小条）。
         * `dvh` 随当前可视区变化；偶发底缘浅色缝仍靠 bleed 与 `bg-canvas` 兜底。
         */
        minHeight: "calc(100dvh + var(--app-viewport-bleed-top))",
      }}
    >
      <div className="relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
