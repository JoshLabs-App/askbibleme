import { useEffect } from "react";
import { useShellSwipeNav } from "./ShellSwipeNavContext";

/** 浮层 / 设置打开时暂停壳层左右滑 */
export function useShellSwipeSuspend(active: boolean) {
  const swipe = useShellSwipeNav();

  useEffect(() => {
    if (!swipe || !active) return;
    swipe.suspendSwipe();
    return () => swipe.resumeSwipe();
  }, [active, swipe]);
}
