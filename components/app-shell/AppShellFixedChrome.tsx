"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = { children: ReactNode };

/**
 * 前台 fixed 壳背景：自然首页与 `/nature` 用 slate-950，与刘海 theme-color / 视频衬底一致；
 * 其它路由保持 canvas。必须在客户端随 pathname 更新（纯 RSC layout 在软导航时不会重跑 path）。
 */
export function AppShellFixedChrome({ children }: Props) {
  const pathname = usePathname() ?? "";
  const natureHomeShell =
    pathname === "/" || pathname === "" || pathname === "/nature" || pathname.startsWith("/nature/");
  const shellBgClass = natureHomeShell ? "bg-slate-950" : "bg-canvas";

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-[1] flex min-h-0 w-full flex-col overflow-hidden transform-gpu ${shellBgClass}`}
    >
      {children}
    </div>
  );
}
