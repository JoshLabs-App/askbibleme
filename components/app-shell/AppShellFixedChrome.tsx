"use client";

import type { ReactNode } from "react";

type Props = { children: ReactNode };

/** 前台 fixed 壳：与品牌 `canvas`（深青）一致，避免自然页与其它路由底色分叉导致顶缘露缝。 */
export function AppShellFixedChrome({ children }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-[1] flex min-h-0 w-full flex-col overflow-hidden transform-gpu bg-canvas"
      style={{
        /** iOS 等：`bottom:0` 与视口单位不一致时壳高偶发短于最大可视高，底缘外露出浅色条 */
        minHeight: "calc(100lvh + var(--app-viewport-bleed-top))",
      }}
    >
      {children}
    </div>
  );
}
