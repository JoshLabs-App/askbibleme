import { useEffect, useRef } from "react";
import { NativeModules, Platform } from "react-native";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import type { MusicPlaybackMode } from "../music/musicPlaybackTypes";
import type { PlaybackTrack } from "../music/types";
import { isTrackPlayable, resolveShellMusicPlayIndex } from "../music/trackArtwork";

export function peekWidgetPlaybackBoot(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    return !!getWidgetPrefsNative()?.peekWidgetPlaybackActionSync?.();
  } catch {
    return false;
  }
}

type WidgetPrefsNative = {
  peekWidgetPlaybackActionSync?: () => string | null;
  clearWidgetPlaybackAction?: () => void;
  minimizeAfterWidgetPlayback?: () => void;
};

function getWidgetPrefsNative(): WidgetPrefsNative | undefined {
  if (Platform.OS !== "android") return undefined;
  return NativeModules.AskBibleWidgetPrefs as WidgetPrefsNative | undefined;
}

type WidgetPlaybackColdStartArgs = {
  loading: boolean;
  tracks: PlaybackTrack[];
  trackIndex: number;
  playing: boolean;
  playbackMode: MusicPlaybackMode;
  playTrackAt: (index: number) => Promise<boolean>;
  startReadingAudio: () => Promise<boolean>;
};

function peekPendingAction(): string | null {
  const mod = getWidgetPrefsNative();
  if (!mod) return null;
  try {
    if (typeof mod.peekWidgetPlaybackActionSync === "function") {
      return mod.peekWidgetPlaybackActionSync() ?? null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isMusicReadyForWidget(tracks: PlaybackTrack[], trackIndex: number): boolean {
  if (tracks.length === 0) return false;
  const playIdx = resolveShellMusicPlayIndex(tracks, trackIndex);
  const track = tracks[playIdx];
  return !!track && isTrackPlayable(track);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMusicPlaying(
  read: () => Pick<WidgetPlaybackColdStartArgs, "playing" | "playbackMode">,
  timeoutMs = 5000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { playing, playbackMode } = read();
    if (playing && playbackMode === "music") return true;
    await sleep(150);
  }
  return false;
}

async function waitForScripturePlaying(
  read: () => Pick<WidgetPlaybackColdStartArgs, "playing" | "playbackMode">,
  timeoutMs = 4000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { playing, playbackMode } = read();
    if (playing && playbackMode === "scripture") return true;
    await sleep(150);
  }
  return false;
}

/** 小挂件冷启动：MainActivity 已拉起后轮询 pending，就绪则 playTrackAt 开播。 */
export function useWidgetPlaybackColdStart(args: WidgetPlaybackColdStartArgs): void {
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    const bootStartedAt = Date.now();
    const log = (message: string, ...args_: unknown[]) => {
      console.warn(`[widget-playback +${Date.now() - bootStartedAt}ms] ${message}`, ...args_);
    };
    log("effect start", {
      loading: args.loading,
      playbackMode: args.playbackMode,
      playing: args.playing,
    });
    if (Platform.OS !== "android") {
      log("skip non-android platform");
      return undefined;
    }
    const nativeModule = getWidgetPrefsNative();
    if (!nativeModule) {
      log("native module missing");
      return undefined;
    }
    if (!nativeModule.peekWidgetPlaybackActionSync) {
      log("sync pending reader missing");
      return undefined;
    }

    let stopped = false;
    let inFlight = false;
    let handledPending = false;
    let attemptCount = 0;

    const attempt = async () => {
      attemptCount += 1;
      if (stopped || inFlight || handledPending) return;
      const pending = peekPendingAction();
      if (!pending) {
        if (attemptCount === 1) log("no pending action");
        handledPending = false;
        return;
      }
      const latest = argsRef.current;
      log("pending detected", {
        pending,
        mode: latest.playbackMode,
        playing: latest.playing,
        loading: latest.loading,
      });
      if (pending === "music") {
        if (!isMusicReadyForWidget(latest.tracks, latest.trackIndex)) {
          log("music not ready", { tracks: latest.tracks.length, trackIndex: latest.trackIndex });
          return;
        }
        inFlight = true;
        try {
          log("music start prepare");
          await configureShellAudioMode();
          const playIdx = resolveShellMusicPlayIndex(latest.tracks, latest.trackIndex);
          log("music playTrackAt begin", { playIdx });
          const started = await latest.playTrackAt(playIdx);
          log("music playTrackAt result", { started });
          if (!started) return;
          log("music waitForPlaying begin");
          const ok = await waitForMusicPlaying(() => argsRef.current);
          log("music waitForPlaying result", { ok });
          if (ok) {
            handledPending = true;
            getWidgetPrefsNative()?.clearWidgetPlaybackAction?.();
            getWidgetPrefsNative()?.minimizeAfterWidgetPlayback?.();
            log("music cold start handled");
          }
        } finally {
          inFlight = false;
        }
        return;
      }

      if (pending === "reading") {
        if (latest.playbackMode === "scripture" && latest.playing) {
          handledPending = true;
          getWidgetPrefsNative()?.clearWidgetPlaybackAction?.();
          getWidgetPrefsNative()?.minimizeAfterWidgetPlayback?.();
          log("reading already playing, handled immediately");
          return;
        }
        inFlight = true;
        try {
          log("reading start begin");
          const started = await latest.startReadingAudio();
          log("reading start result", { started });
          if (!started) return;
          log("reading waitForPlaying begin");
          const ok = await waitForScripturePlaying(() => argsRef.current);
          log("reading waitForPlaying result", { ok });
          if (ok) {
            handledPending = true;
            getWidgetPrefsNative()?.clearWidgetPlaybackAction?.();
            getWidgetPrefsNative()?.minimizeAfterWidgetPlayback?.();
            log("reading cold start handled");
          }
        } finally {
          inFlight = false;
        }
      }
    };

    const initialDelayMs = Platform.OS === "android" ? 250 : 900;
    const intervalMs = Platform.OS === "android" ? 600 : 500;
    log("scheduling attempts", { initialDelayMs, intervalMs });
    const initialDelay = setTimeout(() => void attempt(), initialDelayMs);
    const id = setInterval(() => void attempt(), intervalMs);
    return () => {
      stopped = true;
      log("cleanup");
      clearTimeout(initialDelay);
      clearInterval(id);
    };
  }, []);
}
