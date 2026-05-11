"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  HOME_ATMOSPHERE_STORAGE_KEY,
  isHomeAtmospherePresetId,
  type HomeAtmospherePresetId,
} from "@/music-visual/presets/home-atmosphere";

export type HomeAtmosphereVisualContextValue = {
  homeAtmospherePresetId: HomeAtmospherePresetId;
  setHomeAtmospherePresetId: (id: HomeAtmospherePresetId) => void;
};

const HomeAtmosphereVisualContext = createContext<HomeAtmosphereVisualContextValue | null>(null);

const atmosphereListeners = new Set<() => void>();

function emitAtmosphereChange() {
  atmosphereListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function subscribeAtmosphere(onStore: () => void) {
  if (typeof window === "undefined") return () => {};
  atmosphereListeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HOME_ATMOSPHERE_STORAGE_KEY || e.key === null) onStore();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    atmosphereListeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
}

function readStoredHomeAtmosphere(): HomeAtmospherePresetId {
  if (typeof window === "undefined") return "lagoon";
  try {
    const raw = window.localStorage.getItem(HOME_ATMOSPHERE_STORAGE_KEY);
    if (isHomeAtmospherePresetId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "lagoon";
}

function getAtmosphereSnapshot(): HomeAtmospherePresetId {
  return readStoredHomeAtmosphere();
}

function getAtmosphereServerSnapshot(): HomeAtmospherePresetId {
  return "lagoon";
}

/**
 * 首页「氛围」与壳层音乐视觉（CSS + WebGL）共享的单一来源；子页面未改氛围时保持上次值。
 */
export function HomeAtmosphereVisualProvider({ children }: { children: ReactNode }) {
  const homeAtmospherePresetId = useSyncExternalStore(
    subscribeAtmosphere,
    getAtmosphereSnapshot,
    getAtmosphereServerSnapshot,
  );

  const setHomeAtmospherePresetId = useCallback((id: HomeAtmospherePresetId) => {
    try {
      window.localStorage.setItem(HOME_ATMOSPHERE_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    emitAtmosphereChange();
  }, []);

  const value = useMemo<HomeAtmosphereVisualContextValue>(
    () => ({ homeAtmospherePresetId, setHomeAtmospherePresetId }),
    [homeAtmospherePresetId, setHomeAtmospherePresetId],
  );

  return (
    <HomeAtmosphereVisualContext.Provider value={value}>{children}</HomeAtmosphereVisualContext.Provider>
  );
}

export function useHomeAtmosphereVisual(): HomeAtmosphereVisualContextValue {
  const ctx = useContext(HomeAtmosphereVisualContext);
  if (!ctx) {
    throw new Error("useHomeAtmosphereVisual must be used within HomeAtmosphereVisualProvider");
  }
  return ctx;
}

/** Canvas 等可在壳外降级使用，不抛错 */
export function useHomeAtmosphereVisualOptional(): HomeAtmosphereVisualContextValue | null {
  return useContext(HomeAtmosphereVisualContext);
}
