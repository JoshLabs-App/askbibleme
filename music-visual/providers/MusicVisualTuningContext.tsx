"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_MUSIC_VISUAL_TUNING,
  MUSIC_VISUAL_TUNING_STORAGE_KEY,
  normalizeMusicVisualTuning,
  readMusicVisualTuningFromStorage,
  writeMusicVisualTuningToStorage,
  type MusicVisualTuningV1,
} from "@/music-visual/tuning/schema";

type MusicVisualTuningContextValue = {
  tuning: MusicVisualTuningV1;
  setTuning: (patch: Partial<MusicVisualTuningV1>) => void;
  /** 整表替换（导入 JSON / 控制台） */
  replaceTuning: (next: MusicVisualTuningV1) => void;
  resetTuning: () => void;
};

const MusicVisualTuningContext = createContext<MusicVisualTuningContextValue | null>(null);

export function MusicVisualTuningProvider({ children }: { children: ReactNode }) {
  const [tuning, setTuningState] = useState<MusicVisualTuningV1>(() => ({ ...DEFAULT_MUSIC_VISUAL_TUNING }));

  useEffect(() => {
    setTuningState(readMusicVisualTuningFromStorage());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MUSIC_VISUAL_TUNING_STORAGE_KEY || e.newValue == null) return;
      try {
        setTuningState(normalizeMusicVisualTuning(JSON.parse(e.newValue) as unknown));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTuning = useCallback((patch: Partial<MusicVisualTuningV1>) => {
    setTuningState((prev) => {
      const next = normalizeMusicVisualTuning({ ...prev, ...patch, v: 1 });
      writeMusicVisualTuningToStorage(next);
      return next;
    });
  }, []);

  const replaceTuning = useCallback((next: MusicVisualTuningV1) => {
    const normalized = normalizeMusicVisualTuning(next);
    writeMusicVisualTuningToStorage(normalized);
    setTuningState(normalized);
  }, []);

  const resetTuning = useCallback(() => {
    const next = { ...DEFAULT_MUSIC_VISUAL_TUNING };
    writeMusicVisualTuningToStorage(next);
    setTuningState(next);
  }, []);

  const value = useMemo(
    () => ({
      tuning,
      setTuning,
      replaceTuning,
      resetTuning,
    }),
    [tuning, setTuning, replaceTuning, resetTuning],
  );

  return <MusicVisualTuningContext.Provider value={value}>{children}</MusicVisualTuningContext.Provider>;
}

export function useMusicVisualTuning(): MusicVisualTuningContextValue {
  const ctx = useContext(MusicVisualTuningContext);
  if (!ctx) {
    throw new Error("useMusicVisualTuning must be used within MusicVisualTuningProvider");
  }
  return ctx;
}
