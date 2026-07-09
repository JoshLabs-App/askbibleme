import { createContext, useContext, useEffect, type ReactNode } from "react";
import { resolveReadChapterAudioRegistration } from "./scriptureShellPlayback";
import type { ReadChapterPlaybackRegistration, ScriptureAudioRepeatMode } from "./scripturePlaybackTypes";
import type { MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import type { MusicPlaybackContextValue } from "./musicPlaybackContextTypes";
import { getMusicPlaybackControlSnapshot } from "./musicPlaybackControlSnapshot";
import { useMusicPlaybackProvider } from "./useMusicPlaybackProvider";

export { useScripturePlaybackSec } from "./scripturePlaybackSec";
export { resolveReadChapterAudioRegistration };
export { getMusicPlaybackControlSnapshot };
export type { ReadChapterPlaybackRegistration, ScriptureAudioRepeatMode };
export type { MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";
export type { MusicPlaybackContextValue } from "./musicPlaybackContextTypes";

const MusicPlaybackContext = createContext<MusicPlaybackContextValue | null>(null);

export function MusicPlaybackProvider({ children }: { children: ReactNode }) {
  const value = useMusicPlaybackProvider();
  useEffect(() => {
    if (__DEV__) {
      console.warn("[music-provider] mount");
    }
    return () => {
      if (__DEV__) {
        console.warn("[music-provider] unmount");
      }
    };
  }, []);
  return <MusicPlaybackContext.Provider value={value}>{children}</MusicPlaybackContext.Provider>;
}

export function useMusicPlaybackOptional(): MusicPlaybackContextValue | null {
  return useContext(MusicPlaybackContext);
}

export function useMusicPlayback(): MusicPlaybackContextValue {
  const ctx = useMusicPlaybackOptional();
  if (!ctx) throw new Error("useMusicPlayback must be used within MusicPlaybackProvider");
  return ctx;
}
