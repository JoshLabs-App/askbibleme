import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { ShellSwipeDirection } from "./shellSwipeNav";

export type ShellSwipeActionHandler = (direction: ShellSwipeDirection) => void;

type Ctx = {
  markExclude: () => void;
  clearExclude: () => void;
  isExcluded: () => boolean;
  /** 设置浮层等打开时：整页暂停左右滑 */
  suspendSwipe: () => void;
  resumeSwipe: () => void;
  isSwipeSuspended: () => boolean;
  setSwipeAction: (handler: ShellSwipeActionHandler | null) => void;
  getSwipeAction: () => ShellSwipeActionHandler | null;
};

const ShellSwipeNavContext = createContext<Ctx | null>(null);

export function ShellSwipeNavProvider({ children }: { children: ReactNode }) {
  const excludedRef = useRef(false);
  const suspendCountRef = useRef(0);
  const actionRef = useRef<ShellSwipeActionHandler | null>(null);

  const markExclude = useCallback(() => {
    excludedRef.current = true;
  }, []);

  const clearExclude = useCallback(() => {
    excludedRef.current = false;
  }, []);

  const isExcluded = useCallback(() => excludedRef.current, []);

  const suspendSwipe = useCallback(() => {
    suspendCountRef.current += 1;
  }, []);

  const resumeSwipe = useCallback(() => {
    suspendCountRef.current = Math.max(0, suspendCountRef.current - 1);
  }, []);

  const isSwipeSuspended = useCallback(() => suspendCountRef.current > 0, []);

  const setSwipeAction = useCallback((handler: ShellSwipeActionHandler | null) => {
    actionRef.current = handler;
  }, []);

  const getSwipeAction = useCallback(() => actionRef.current, []);

  const value = useMemo(
    () => ({
      markExclude,
      clearExclude,
      isExcluded,
      suspendSwipe,
      resumeSwipe,
      isSwipeSuspended,
      setSwipeAction,
      getSwipeAction,
    }),
    [markExclude, clearExclude, isExcluded, suspendSwipe, resumeSwipe, isSwipeSuspended, setSwipeAction, getSwipeAction],
  );

  return <ShellSwipeNavContext.Provider value={value}>{children}</ShellSwipeNavContext.Provider>;
}

export function useShellSwipeNav() {
  return useContext(ShellSwipeNavContext);
}
