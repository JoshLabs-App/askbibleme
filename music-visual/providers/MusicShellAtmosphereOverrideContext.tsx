"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HomeAtmospherePresetId } from "@/music-visual/presets/home-atmosphere";

type MusicShellAtmosphereOverrideContextValue = {
  /** 非 null 时壳层引擎使用该氛围，与 `HOME_ATMOSPHERE_STORAGE_KEY` 解耦（音乐路由专用） */
  overrideId: HomeAtmospherePresetId | null;
  setOverrideId: (id: HomeAtmospherePresetId) => void;
  clearOverride: () => void;
};

const MusicShellAtmosphereOverrideContext =
  createContext<MusicShellAtmosphereOverrideContextValue | null>(null);

export function MusicShellAtmosphereOverrideProvider({ children }: { children: ReactNode }) {
  const [overrideId, setOverrideState] = useState<HomeAtmospherePresetId | null>(null);
  const setOverrideId = useCallback((id: HomeAtmospherePresetId) => {
    setOverrideState(id);
  }, []);
  const clearOverride = useCallback(() => {
    setOverrideState(null);
  }, []);

  const value = useMemo<MusicShellAtmosphereOverrideContextValue>(
    () => ({ overrideId, setOverrideId, clearOverride }),
    [overrideId, setOverrideId, clearOverride],
  );

  return (
    <MusicShellAtmosphereOverrideContext.Provider value={value}>
      {children}
    </MusicShellAtmosphereOverrideContext.Provider>
  );
}

export function useMusicShellAtmosphereOverride(): MusicShellAtmosphereOverrideContextValue {
  const ctx = useContext(MusicShellAtmosphereOverrideContext);
  if (!ctx) {
    throw new Error(
      "useMusicShellAtmosphereOverride must be used within MusicShellAtmosphereOverrideProvider",
    );
  }
  return ctx;
}

export function useMusicShellAtmosphereOverrideOptional(): MusicShellAtmosphereOverrideContextValue | null {
  return useContext(MusicShellAtmosphereOverrideContext);
}
