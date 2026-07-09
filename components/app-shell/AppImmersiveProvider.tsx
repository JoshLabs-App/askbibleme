"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  readAppImmersiveFromStorage,
  subscribeAppImmersive,
  writeAppImmersiveToStorage,
} from "@/lib/ui/app-immersive";

type AppImmersiveContextValue = {
  immersive: boolean;
  setImmersive: (next: boolean) => void;
  toggleImmersive: () => void;
};

const AppImmersiveContext = createContext<AppImmersiveContextValue | null>(null);

function getSnapshot(): string {
  if (typeof window === "undefined") return "0";
  return readAppImmersiveFromStorage() ? "1" : "0";
}

function parseSnapshot(raw: string): boolean {
  return raw === "1";
}

export function AppImmersiveProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeAppImmersive, getSnapshot, () => "0");
  const immersive = parseSnapshot(snapshot);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (immersive) {
      root.setAttribute("data-app-immersive", "");
      return () => root.removeAttribute("data-app-immersive");
    }
    root.removeAttribute("data-app-immersive");
    return undefined;
  }, [immersive]);

  const setImmersive = useCallback((next: boolean) => {
    writeAppImmersiveToStorage(next);
  }, []);

  const toggleImmersive = useCallback(() => {
    writeAppImmersiveToStorage(!immersive);
  }, [immersive]);

  const value = useMemo(
    () => ({
      immersive,
      setImmersive,
      toggleImmersive,
    }),
    [immersive, setImmersive, toggleImmersive],
  );

  return <AppImmersiveContext.Provider value={value}>{children}</AppImmersiveContext.Provider>;
}

export function useAppImmersive(): AppImmersiveContextValue {
  const v = useContext(AppImmersiveContext);
  if (!v) throw new Error("useAppImmersive must be used within AppImmersiveProvider");
  return v;
}

