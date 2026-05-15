"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNatureHomeShellPath } from "@/components/home/HomeDockChromeContext";

/** 与 `HomeShellFloatingRouteNav` 左→右（不含中央播放；不含放松入口）一致 */
const ROUTE_SWIPE_ORDER = ["/", "/scenes", "/verse", "/prayer"] as const;

const SWIPE_MIN_DX = 56;

function routeSwipeIndex(pathname: string): number | null {
  const p = pathname || "";
  if (p.startsWith("/admin")) return null;
  if (isNatureHomeShellPath(p)) return 0;
  if (p === "/scenes" || p.startsWith("/scenes/")) return 1;
  if (p === "/verse" || p.startsWith("/verse/")) return 2;
  if (p.startsWith("/prayer")) return 3;
  return null;
}

type Props = { children: ReactNode };

/**
 * 主壳纵向滚动区：在底栏「主路径」上支持左右滑切换路由（与图标条顺序一致）。
 * 命中 `data-shell-swipe-nav-exclude` 内的触控不触发，以免与横向场景条等冲突。
 */
export function AppShellScrollArea({ children }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const s = startRef.current;
      startRef.current = null;
      if (!s || e.changedTouches.length !== 1) return;

      const raw = e.target;
      if (raw instanceof Element && raw.closest("[data-shell-swipe-nav-exclude]")) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      const idx = routeSwipeIndex(pathname);
      if (idx === null) return;

      const next = dx < 0 ? idx + 1 : idx - 1;
      if (next < 0 || next >= ROUTE_SWIPE_ORDER.length) return;

      router.push(ROUTE_SWIPE_ORDER[next]);
    },
    [pathname, router],
  );

  return (
    <div
      data-app-shell-scroll
      className="relative z-0 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain border-0 border-b-0 shadow-none [-webkit-overflow-scrolling:touch]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}
