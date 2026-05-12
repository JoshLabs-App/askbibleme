"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { atmosphereScalarsFromPreset } from "@/music-visual/effects/atmosphere-engine-scalars";
import {
  applyMusicVisualTuningToElement,
  createMusicVisualSmoothState,
  stepMusicVisualEngine,
  writeMusicVisualDriveCss,
} from "@/music-visual/engine/step";
import { useHomeAtmosphereVisual } from "@/music-visual/providers/HomeAtmosphereVisualContext";
import { useMusicShellAtmosphereOverrideOptional } from "@/music-visual/providers/MusicShellAtmosphereOverrideContext";
import { useMusicVisualTuning } from "@/music-visual/providers/MusicVisualTuningContext";
import { getMusicVisualAtmospherePresetForHome } from "@/music-visual/presets/home-atmosphere";
import { IDLE_MUSIC_VISUAL_DRIVE, type MusicVisualDriveSnapshot } from "@/music-visual/types/drive";
import { findAudioTrackBySrc } from "@/lib/music/resolve-track-by-src";
import { parseTrackAnalysisJson, type TrackAudioAnalysisV1 } from "@/lib/music/track-analysis";

export type MusicShellVisualValue = {
  /** 当前曲目是否带有可读的预计算分析 */
  hasAnalysis: boolean;
  /** 每帧（首页·音乐或播放中）或低频 tick 内更新；读 `.current` 不触发 React 渲染 */
  driveRef: MutableRefObject<MusicVisualDriveSnapshot>;
};

const MusicShellVisualContext = createContext<MusicShellVisualValue | null>(null);

export function useMusicShellVisual(): MusicShellVisualValue {
  const ctx = useContext(MusicShellVisualContext);
  if (!ctx) {
    throw new Error("useMusicShellVisual must be used within MusicShellVisualProvider");
  }
  return ctx;
}

const IDLE_STYLE: CSSProperties = {
  ["--music-rms" as string]: "0.06",
  ["--music-low" as string]: "0",
  ["--music-mid" as string]: "0",
  ["--music-high" as string]: "0",
  ["--music-master" as string]: "1",
  ["--music-tune-glow-mul" as string]: "1",
  ["--music-tune-glow-dark-extra" as string]: "1",
  ["--music-tune-shell-amp" as string]: "0.09",
  ["--music-tune-play-mul" as string]: "1",
};

/**
 * 壳层音乐驱动视觉：有预计算 JSON 时按 `currentTime` 查表；否则播放中用低频「呼吸」占位。
 * 强度由 `MusicVisualTuningProvider` + 首页「播放视觉」面板调节。
 * 首页氛围经 `HomeAtmosphereVisualProvider` 映射为引擎 atmosphere 乘子。
 *
 * 省电 / 克制：`document` 隐藏时停表；非 `/music` 路由一律低频 tick（即使正在播放），避免与全屏视频或其它页争主线程。
 */
export function MusicShellVisualProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { effectiveSrc, musicStore, getAudioElement } = useMusicShellPlayback();
  const { tuning } = useMusicVisualTuning();
  const { homeAtmospherePresetId } = useHomeAtmosphereVisual();
  const atmosphereOverride = useMusicShellAtmosphereOverrideOptional();
  const resolvedHomeAtmospherePresetId =
    atmosphereOverride?.overrideId ?? homeAtmospherePresetId;
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;

  const atmosphereScalars = useMemo(() => {
    const preset = getMusicVisualAtmospherePresetForHome(resolvedHomeAtmospherePresetId);
    return atmosphereScalarsFromPreset(preset);
  }, [resolvedHomeAtmospherePresetId]);
  const atmosphereScalarsRef = useRef(atmosphereScalars);
  atmosphereScalarsRef.current = atmosphereScalars;

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const rootRef = useRef<HTMLDivElement>(null);
  /** `<audio>` ref 极少数首帧尚未挂载时用占位元素推进引擎，避免整段视觉引擎永远不启动 */
  const ghostAudioRef = useRef<HTMLAudioElement | null>(null);
  const driveRef = useRef<MusicVisualDriveSnapshot>({ ...IDLE_MUSIC_VISUAL_DRIVE });
  const [analysis, setAnalysis] = useState<TrackAudioAnalysisV1 | null>(null);

  const track = useMemo(() => findAudioTrackBySrc(musicStore, effectiveSrc), [musicStore, effectiveSrc]);

  const onMusicRoute = pathname === "/music" || pathname.startsWith("/music/");

  useEffect(() => {
    if (!onMusicRoute) {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    const src = track?.analysisSrc?.trim();
    setAnalysis(null);
    if (!src) return;
    void (async () => {
      try {
        const res = await fetch(src, { cache: "force-cache" });
        if (!res.ok || cancelled) return;
        const raw: unknown = await res.json();
        if (cancelled) return;
        const parsed = parseTrackAnalysisJson(raw);
        if (parsed) setAnalysis(parsed);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track?.analysisSrc, onMusicRoute]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    if (!ghostAudioRef.current && typeof document !== "undefined") {
      ghostAudioRef.current = document.createElement("audio");
    }

    let raf = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const smooth = createMusicVisualSmoothState();

    const isMusicRoute = () => {
      const p = pathnameRef.current;
      return p === "/music" || p.startsWith("/music/");
    };

    /**
     * 仅音乐全屏页用 rAF 与节拍对齐。在 `/journey`、`/read` 等页「只听歌」时若仍 60fps 写 `--music-*`，
     * 主线程与合成压力会明显升高，iPhone 上易出现周期闪卡；这些页用下面 `setTimeout` 低频即可。
     */
    const isHighPriority = () => isMusicRoute();

    const clearSched = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (idleTimer != null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const applyHiddenIdle = () => {
      clearSched();
      Object.assign(el.style, IDLE_STYLE as Record<string, string>);
      driveRef.current = { ...IDLE_MUSIC_VISUAL_DRIVE };
    };

    const pump = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        applyHiddenIdle();
        return;
      }

      const T = tuningRef.current;
      const audio = getAudioElement() ?? ghostAudioRef.current;
      if (audio) {
        applyMusicVisualTuningToElement(el, T, atmosphereScalarsRef.current);
        stepMusicVisualEngine(
          smooth,
          analysis,
          audio,
          T,
          performance.now(),
          driveRef.current,
          atmosphereScalarsRef.current,
        );
        writeMusicVisualDriveCss(el, driveRef.current);
      } else {
        applyMusicVisualTuningToElement(el, T, atmosphereScalarsRef.current);
      }

      if (isHighPriority()) {
        raf = requestAnimationFrame(pump);
      } else {
        idleTimer = setTimeout(() => {
          idleTimer = null;
          pump();
        }, 125);
      }
    };

    const kick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      clearSched();
      pump();
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") applyHiddenIdle();
      else kick();
    };

    kick();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearSched();
      Object.assign(el.style, IDLE_STYLE as Record<string, string>);
      driveRef.current = { ...IDLE_MUSIC_VISUAL_DRIVE };
    };
  }, [analysis, getAudioElement]);

  const value = useMemo<MusicShellVisualValue>(
    () => ({ hasAnalysis: Boolean(analysis), driveRef }),
    [analysis],
  );

  return (
    <MusicShellVisualContext.Provider value={value}>
      <div
        ref={rootRef}
        className="music-shell-visual-root flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-visible bg-appDark"
        style={IDLE_STYLE}
      >
        {children}
      </div>
    </MusicShellVisualContext.Provider>
  );
}
