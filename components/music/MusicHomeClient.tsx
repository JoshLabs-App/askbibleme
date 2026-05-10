"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientBackdrop } from "@/components/music/AmbientBackdrop";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import {
  HOME_ATMOSPHERE_PRESETS,
  type HomeAtmospherePresetId,
  useHomeAtmosphereVisual,
} from "@/music-visual";
import type {
  AudioTrack,
  BackgroundVisual,
  MusicCompanionStore,
  Scene,
} from "@/lib/music-companion/types";
import { HomeMusicFloatingChrome } from "@/components/home/HomeMusicFloatingChrome";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { IconSkipBack, IconSkipForward } from "@/components/ui/MediaPlaybackIcons";
import { resolveLocalized } from "@/lib/i18n/localized-text";

const SacredAtmosphereCanvas = dynamic(
  () =>
    import("@/music-visual/components/sacred-atmosphere/SacredAtmosphereCanvas").then((m) => ({
      default: m.SacredAtmosphereCanvas,
    })),
  { ssr: false },
);

type Props = {
  initialStore: MusicCompanionStore;
  /** URL `?atmosphere=` 或旧 `?ambient=`；null 时不覆盖 Context（沿用 localStorage） */
  atmosphereUrlOverride: HomeAtmospherePresetId | null;
};

function pickScene(store: MusicCompanionStore): Scene | null {
  const { scenes, defaultSceneId } = store;
  if (scenes.length === 0) return null;
  if (defaultSceneId) {
    const s = scenes.find((x) => x.id === defaultSceneId);
    if (s) return s;
  }
  return [...scenes].sort((a, b) => a.order - b.order)[0] ?? null;
}

function byId<T extends { id: string }>(list: T[], id: string | null): T | null {
  if (!id) return null;
  return list.find((x) => x.id === id) ?? null;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function initialSceneIndex(s: MusicCompanionStore): number {
  const ord = [...s.scenes].sort((a, b) => a.order - b.order);
  if (ord.length === 0) return 0;
  if (s.defaultSceneId) {
    const i = ord.findIndex((x) => x.id === s.defaultSceneId);
    if (i >= 0) return i;
  }
  return 0;
}

/** 与壳层默认曲一致：场景绑定曲目在池中的下标（不用随机，避免与首页一键播放错位） */
function computeDefaultTrackPoolIdx(store: MusicCompanionStore, sceneIdx: number): number {
  const tracks = store.audioTracks.filter((t) => t.src?.trim());
  if (tracks.length === 0) return 0;
  const ord = [...store.scenes].sort((a, b) => a.order - b.order);
  if (ord.length === 0) return 0;
  const si = Math.min(Math.max(0, sceneIdx), ord.length - 1);
  const scene = ord[si] ?? null;
  const want = scene?.audioTrackId ?? null;
  const i = want ? tracks.findIndex((t) => t.id === want) : -1;
  return i >= 0 ? i : 0;
}

function urlsEqual(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return false;
  if (typeof window === "undefined") return x === y;
  try {
    return new URL(x, window.location.href).href === new URL(y, window.location.href).href;
  } catch {
    return x === y;
  }
}

function countTracksWithSrc(store: MusicCompanionStore): number {
  return store.audioTracks.filter((t) => t.src?.trim()).length;
}

function countImageBgs(store: MusicCompanionStore): number {
  return store.backgroundVisuals.filter((b) => b.type === "image" && b.imageSrc?.trim()).length;
}

function randomPoolIndex(n: number): number {
  if (n <= 1) return 0;
  return Math.floor(Math.random() * n);
}

function replaceAtmosphereSearchParam(id: HomeAtmospherePresetId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("ambient");
  url.searchParams.set("atmosphere", id);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function MusicHomeClient({ initialStore, atmosphereUrlOverride }: Props) {
  const { locale, t } = useLocale();
  const { homeAtmospherePresetId, setHomeAtmospherePresetId } = useHomeAtmosphereVisual();
  const urlOverrideAppliedRef = useRef(false);

  useEffect(() => {
    if (!atmosphereUrlOverride || urlOverrideAppliedRef.current) return;
    urlOverrideAppliedRef.current = true;
    setHomeAtmospherePresetId(atmosphereUrlOverride);
  }, [atmosphereUrlOverride, setHomeAtmospherePresetId]);

  const {
    pausePlayback,
    currentSec,
    durationSec,
    seekRatio,
    setPlaybackSrc,
    effectiveSrc,
  } = useMusicShellPlayback();
  const [store, setStore] = useState<MusicCompanionStore>(initialStore);
  const initialSi = initialSceneIndex(initialStore);
  const [sceneIndex, setSceneIndex] = useState(() => initialSi);
  const [trackPoolIdx, setTrackPoolIdx] = useState(() =>
    computeDefaultTrackPoolIdx(initialStore, initialSi),
  );
  const fullMusicSrcGateDone = useRef(false);
  /** 用户刚点上一首/下一首/随机：短时间内优先信任 trackPoolIdx，避免壳层 ended 已切歌而此处仍用旧 URL 把播放源推回去导致更新风暴 */
  const userSkipAtRef = useRef(0);
  const bumpUserSkip = () => {
    userSkipAtRef.current = typeof performance !== "undefined" ? performance.now() : 0;
  };
  const setPlaybackSrcRef = useRef(setPlaybackSrc);
  setPlaybackSrcRef.current = setPlaybackSrc;
  const [bgMode, setBgMode] = useState<"images" | "ambient">("ambient");
  /** 图片模式前台调节（不落盘） */
  const [imgBlurPx, setImgBlurPx] = useState(0);
  const [imgOpacity, setImgOpacity] = useState(1);
  const [imgDim, setImgDim] = useState(0);
  const [imgSaturate, setImgSaturate] = useState(1);
  const [imgFxOpen, setImgFxOpen] = useState(false);
  const imgFxRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bgMode !== "images") setImgFxOpen(false);
  }, [bgMode]);

  useEffect(() => {
    if (!imgFxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImgFxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imgFxOpen]);

  useEffect(() => {
    if (!imgFxOpen) return;
    const onDown = (e: MouseEvent) => {
      if (imgFxRootRef.current && !imgFxRootRef.current.contains(e.target as Node)) {
        setImgFxOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [imgFxOpen]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/music/companion", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const next = (await res.json()) as MusicCompanionStore | { error?: string };
        if ("error" in next && next.error) return;
        if (!cancelled) setStore(next as MusicCompanionStore);
      } catch {
        /* ignore */
      }
    };
    void load();
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const orderedScenes = useMemo(
    () => [...store.scenes].sort((a, b) => a.order - b.order),
    [store.scenes],
  );

  useEffect(() => {
    const n = orderedScenes.length;
    setSceneIndex((i) => {
      if (n <= 0) return 0;
      return Math.min(Math.max(0, i), n - 1);
    });
  }, [orderedScenes.length]);

  const scene = orderedScenes[sceneIndex] ?? pickScene(store);

  const tracksWithSrc = useMemo(
    () => store.audioTracks.filter((t) => t.src?.trim()),
    [store.audioTracks],
  );

  /** 曲目 id/src 集合的稳定键；成员变化时强制重新解析当前曲与壳层 URL 的对齐关系 */
  const trackPoolSyncKey = useMemo(
    () =>
      store.audioTracks
        .filter((t) => Boolean(t.src?.trim()))
        .map((t) => `${t.id}\u001f${(t.src ?? "").trim()}`)
        .join("\u001e"),
    [store.audioTracks],
  );

  const resolvedTrackIdx = useMemo(() => {
    const tracks = tracksWithSrc;
    if (!tracks.length) return 0;
    const es = effectiveSrc.trim();
    const k = Math.min(Math.max(0, trackPoolIdx), tracks.length - 1);
    const atKSrc = (tracks[k]?.src ?? "").trim();
    if (!es) return k;
    if (urlsEqual(atKSrc, es)) return k;
    const j = tracks.findIndex((t) => urlsEqual((t.src ?? "").trim(), es));
    if (j < 0) return k;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    if (now - userSkipAtRef.current < 720) return k;
    return j;
  }, [effectiveSrc, trackPoolIdx, tracksWithSrc, trackPoolSyncKey]);

  const resolvedTrackIdxRef = useRef(0);
  resolvedTrackIdxRef.current = resolvedTrackIdx;

  const imageBgs = useMemo(
    () => store.backgroundVisuals.filter((b) => b.type === "image" && b.imageSrc?.trim()),
    [store.backgroundVisuals],
  );

  const defaultTrackPoolIdx = useMemo(() => {
    if (tracksWithSrc.length === 0) return 0;
    const want = scene?.audioTrackId ?? null;
    const i = want ? tracksWithSrc.findIndex((t) => t.id === want) : -1;
    return i >= 0 ? i : 0;
  }, [scene?.audioTrackId, scene?.id, tracksWithSrc]);

  const defaultImagePoolIdx = useMemo(() => {
    if (imageBgs.length === 0) return 0;
    const want = scene?.backgroundVisualId ?? null;
    const i = want ? imageBgs.findIndex((b) => b.id === want) : -1;
    return i >= 0 ? i : 0;
  }, [scene?.backgroundVisualId, scene?.id, imageBgs]);

  const initialTrackCount = countTracksWithSrc(initialStore);
  const initialImageCount = countImageBgs(initialStore);
  const [imagePoolIdx, setImagePoolIdx] = useState(() => randomPoolIndex(initialImageCount));
  const initialTrackCountRef = useRef(initialTrackCount);
  const initialImageCountRef = useRef(initialImageCount);
  const prevSceneIdForPoolRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const n = tracksWithSrc.length;
    const wasN = initialTrackCountRef.current;
    if (wasN <= 1 && n > 1) {
      initialTrackCountRef.current = n;
      setTrackPoolIdx(computeDefaultTrackPoolIdx(store, sceneIndex));
    }
  }, [tracksWithSrc.length, store, sceneIndex]);

  useEffect(() => {
    const n = imageBgs.length;
    const wasN = initialImageCountRef.current;
    if (wasN <= 1 && n > 1) {
      initialImageCountRef.current = n;
      setImagePoolIdx(randomPoolIndex(n));
    }
  }, [imageBgs.length]);

  useEffect(() => {
    const sid = scene?.id ?? null;
    const prev = prevSceneIdForPoolRef.current;
    if (prev === undefined) {
      prevSceneIdForPoolRef.current = sid;
      return;
    }
    if (prev !== sid) {
      prevSceneIdForPoolRef.current = sid;
      setTrackPoolIdx(defaultTrackPoolIdx);
      setImagePoolIdx(defaultImagePoolIdx);
    }
  }, [scene?.id, defaultTrackPoolIdx, defaultImagePoolIdx]);

  useEffect(() => {
    setTrackPoolIdx((i) =>
      tracksWithSrc.length === 0 ? 0 : Math.min(i, tracksWithSrc.length - 1),
    );
  }, [tracksWithSrc.length]);

  useEffect(() => {
    setImagePoolIdx((i) =>
      imageBgs.length === 0 ? 0 : Math.min(i, imageBgs.length - 1),
    );
  }, [imageBgs.length]);

  const track = useMemo(() => {
    if (tracksWithSrc.length > 0) {
      return tracksWithSrc[
        Math.min(resolvedTrackIdx, tracksWithSrc.length - 1)
      ];
    }
    const sceneTrack = scene
      ? (byId(store.audioTracks, scene.audioTrackId) as AudioTrack | null)
      : null;
    if (sceneTrack?.src?.trim()) return sceneTrack;
    return store.audioTracks.find((t) => t.src?.trim()) ?? sceneTrack;
  }, [tracksWithSrc, resolvedTrackIdx, scene, store.audioTracks]);

  const trackArtist = useMemo(
    () => resolveLocalized(track?.artist, locale).trim(),
    [track?.artist, locale],
  );

  const sceneDrivenBg = useMemo(
    () =>
      scene
        ? (byId(store.backgroundVisuals, scene.backgroundVisualId) as BackgroundVisual | null)
        : null,
    [scene, store.backgroundVisuals],
  );

  /** 有多张上传图时在图池里切换；否则用场景上的渐变/单图 */
  const displayBg = useMemo(() => {
    if (imageBgs.length > 0) {
      return imageBgs[Math.min(imagePoolIdx, imageBgs.length - 1)];
    }
    return sceneDrivenBg;
  }, [imageBgs, imagePoolIdx, sceneDrivenBg]);

  useEffect(() => {
    if (displayBg?.type === "image") {
      setImgBlurPx(displayBg.blur ? 8 : 0);
    } else {
      setImgBlurPx(0);
    }
  }, [displayBg?.id, displayBg?.type, displayBg?.blur]);

  const audioSrc = track?.src?.trim() ?? "";

  useEffect(() => {
    const want = audioSrc.trim();
    if (!want) {
      setPlaybackSrcRef.current(null);
      return;
    }
    const cur = effectiveSrc.trim();
    if (urlsEqual(want, cur)) return;

    if (!fullMusicSrcGateDone.current) {
      fullMusicSrcGateDone.current = true;
      if (cur) return;
    }

    setPlaybackSrcRef.current(want);
  }, [audioSrc, effectiveSrc]);

  const shuffleTrack = useCallback(() => {
    bumpUserSkip();
    const n = tracksWithSrc.length;
    if (n <= 1) return;
    const cur = resolvedTrackIdxRef.current;
    let next = cur;
    for (let g = 0; g < 40 && next === cur; g++) {
      next = Math.floor(Math.random() * n);
    }
    setTrackPoolIdx(next);
  }, [tracksWithSrc.length]);

  const shuffleImage = useCallback(() => {
    setImagePoolIdx((cur) => {
      const n = imageBgs.length;
      if (n <= 1) return cur;
      let next = cur;
      for (let g = 0; g < 40 && next === cur; g++) {
        next = Math.floor(Math.random() * n);
      }
      return next;
    });
  }, [imageBgs]);

  const nextScene = useCallback(() => {
    if (orderedScenes.length <= 1) return;
    setSceneIndex((i) => (i + 1) % orderedScenes.length);
    pausePlayback();
  }, [orderedScenes.length, pausePlayback]);

  const prevScene = useCallback(() => {
    if (orderedScenes.length <= 1) return;
    setSceneIndex((i) => (i - 1 + orderedScenes.length) % orderedScenes.length);
    pausePlayback();
  }, [orderedScenes.length, pausePlayback]);

  const showLateralNav = tracksWithSrc.length > 1 || orderedScenes.length > 1;

  const goLeft = useCallback(() => {
    if (tracksWithSrc.length > 1) {
      bumpUserSkip();
      const n = tracksWithSrc.length;
      const cur = resolvedTrackIdxRef.current;
      setTrackPoolIdx((cur - 1 + n) % n);
      return;
    }
    prevScene();
  }, [tracksWithSrc.length, prevScene]);

  const goRight = useCallback(() => {
    if (tracksWithSrc.length > 1) {
      bumpUserSkip();
      const n = tracksWithSrc.length;
      const cur = resolvedTrackIdxRef.current;
      setTrackPoolIdx((cur + 1) % n);
      return;
    }
    nextScene();
  }, [tracksWithSrc.length, nextScene]);

  const bgStyle: React.CSSProperties = {};
  const showImageBackdrop = bgMode === "images";
  let imageBackdropFilter: string | undefined;
  if (showImageBackdrop) {
    const f: string[] = [];
    const blurPx = Math.min(imgBlurPx, 12);
    if (blurPx > 0.01) f.push(`blur(${blurPx}px)`);
    if (Math.abs(imgSaturate - 1) > 0.01) f.push(`saturate(${imgSaturate})`);
    imageBackdropFilter = f.length > 0 ? f.join(" ") : undefined;
  }
  if (showImageBackdrop) {
    if (displayBg?.type === "gradient" && displayBg.cssGradient) {
      Object.assign(bgStyle, {
        backgroundColor: "#45382E",
        background: displayBg.cssGradient,
      });
    } else if (displayBg?.type === "image" && displayBg.imageSrc) {
      const safe = displayBg.imageSrc.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      Object.assign(bgStyle, {
        backgroundColor: "#2E261C",
        backgroundImage: `url("${safe}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      });
    } else {
      Object.assign(bgStyle, {
        background:
          "linear-gradient(165deg, #6a5846 0%, #45382E 40%, #2E261C 100%)",
      });
    }
  }

  return (
    <div className="relative mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden bg-ink text-canvas shadow-2xl lg:mx-0 lg:h-full lg:max-h-none lg:min-h-0 lg:w-full lg:max-w-none lg:flex-1 lg:rounded-none lg:shadow-none lg:ring-0">

      <div className="pointer-events-none absolute inset-0 z-0 isolate min-h-full min-w-full overflow-hidden music-reactive-home-shell">
        {showImageBackdrop ? (
          <div className="absolute inset-0 z-0 min-h-full min-w-full overflow-hidden bg-[#45382E]">
            <div
              className="absolute inset-0 min-h-full min-w-full transition-[opacity,filter] duration-300 ease-out"
              style={{
                ...bgStyle,
                opacity: imgOpacity,
                filter: imageBackdropFilter,
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-black/[0.35]"
              aria-hidden
            />
            {imgDim > 0.005 ? (
              <div
                className="pointer-events-none absolute inset-0 bg-black"
                style={{ opacity: imgDim }}
                aria-hidden
              />
            ) : null}
          </div>
        ) : (
          <AmbientBackdrop preset={homeAtmospherePresetId} />
        )}
        <div
          className={`pointer-events-none absolute inset-0 z-[2] mix-blend-soft-light ${
            showImageBackdrop ? "opacity-[0.34]" : "opacity-[0.44]"
          }`}
          aria-hidden
        >
          <SacredAtmosphereCanvas />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-[3]" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-black/[0.22] to-black/[0.5] lg:from-black/10 lg:via-black/20 lg:to-black/[0.46]" />
        <div className="absolute left-1/2 top-[min(30dvh,38%)] h-[min(92vw,34rem)] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,200,160,0.16)_0%,rgba(230,160,105,0.055)_40%,transparent_70%)]" />
      </div>
      {/* 底部轻晕：读取 `--music-*`，与后台「光晕 / 深色光晕」同源；置于 z-[3] 渐变之上否则完全被盖住 */}
      <div
        className="music-reactive-home-glow-dark pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[min(38vh,17rem)] bg-gradient-to-t from-black/45 via-black/14 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <HomeMusicFloatingChrome />

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pt-[max(0.25rem,calc(env(safe-area-inset-top)+2.35rem))] lg:pt-[max(0.35rem,calc(env(safe-area-inset-top)+2.55rem))]">
      <div className="relative z-10 flex flex-col items-center justify-start px-4 pt-5 text-center sm:px-5 sm:pt-6 lg:px-6 lg:pt-7 xl:px-8">
        <div className="flex w-full max-w-xl flex-col items-center lg:max-w-2xl">
          <div className="min-w-0 w-full pt-[clamp(1rem,12dvh,6rem)] opacity-0 motion-reduce:animate-none motion-reduce:opacity-100 animate-music-hero-fade">
          {tracksWithSrc.length > 1 ? (
            <button
              type="button"
              onClick={() => shuffleTrack()}
              aria-label={t("music.home.shuffleTrack")}
              className="group w-full rounded-2xl px-2 py-4 text-center transition active:scale-[0.99] sm:px-3 lg:rounded-3xl lg:px-5 lg:py-7 lg:transition-colors lg:hover:bg-white/[0.03]"
            >
              <HomeVerseRotator variant="dark" prominence="hero" className="w-full" />
              {trackArtist ? (
                <p className="mt-5 text-sm font-normal text-white/[0.78] drop-shadow-sm lg:mt-6 lg:text-base">
                  {trackArtist}
                </p>
              ) : null}
            </button>
          ) : (
            <>
              <HomeVerseRotator variant="dark" prominence="hero" className="w-full" />
              {trackArtist ? (
                <p className="mt-5 text-sm font-normal text-white/[0.78] drop-shadow-sm lg:mt-6 lg:text-base">{trackArtist}</p>
              ) : null}
            </>
          )}
          </div>
        </div>
        {!audioSrc ? (
          <p className="mt-4 max-w-[16rem] text-xs leading-relaxed text-amber-100/90 lg:max-w-md lg:text-sm">
            {t("music.home.noAudioBefore")}{" "}
            <Link href="/admin/music" className="underline underline-offset-2">
              {t("music.home.adminMusic")}
            </Link>{" "}
            {t("music.home.noAudioAfter")}
          </p>
        ) : null}
      </div>
        </div>

        <footer className="relative z-10 mt-0 flex w-full shrink-0 flex-col items-stretch gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-xs text-white/55 lg:mx-auto lg:max-w-2xl lg:gap-4 lg:px-6 lg:pb-5 lg:pt-4 lg:text-[13px] lg:text-white/48 xl:max-w-3xl xl:px-8">
        {showLateralNav ? (
          <div className="flex items-center justify-center gap-10 lg:gap-12">
            <button
              type="button"
              onClick={goLeft}
              aria-label={tracksWithSrc.length > 1 ? t("music.home.prevTrack") : t("music.home.prevScene")}
              title={tracksWithSrc.length > 1 ? t("music.home.prevTrack") : t("music.home.prevScene")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-white/55 backdrop-blur-sm transition hover:bg-white/[0.1] hover:text-white/85 active:scale-[0.97] lg:h-11 lg:w-11"
            >
              <IconSkipBack className="h-[18px] w-[18px] shrink-0 lg:h-5 lg:w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={goRight}
              aria-label={tracksWithSrc.length > 1 ? t("music.home.nextTrack") : t("music.home.nextScene")}
              title={tracksWithSrc.length > 1 ? t("music.home.nextTrack") : t("music.home.nextScene")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-white/55 backdrop-blur-sm transition hover:bg-white/[0.1] hover:text-white/85 active:scale-[0.97] lg:h-11 lg:w-11"
            >
              <IconSkipForward className="h-[18px] w-[18px] shrink-0 lg:h-5 lg:w-5" aria-hidden />
            </button>
          </div>
        ) : null}
        {audioSrc ? (
          <div className="flex items-center gap-3.5 text-[11px] tabular-nums text-white/[0.5] lg:text-[12px] lg:text-white/45">
            <span className="min-w-[2.5rem] shrink-0">{formatTime(currentSec)}</span>
            <button
              type="button"
              aria-label={t("music.home.progress")}
              className="group relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.1]"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - r.left;
                seekRatio(x / r.width);
              }}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-white/[0.88] shadow-[0_0_14px_rgba(255,255,255,0.35),0_0_28px_rgba(255,245,230,0.12)] transition-[width] duration-150 ease-out group-hover:bg-white/[0.95] group-hover:shadow-[0_0_18px_rgba(255,255,255,0.42)]"
                style={{
                  width: `${durationSec ? Math.min(100, (currentSec / durationSec) * 100) : 0}%`,
                }}
              />
            </button>
            <span className="min-w-[2.5rem] shrink-0 text-right">{formatTime(durationSec)}</span>
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-2 pt-2 lg:gap-2.5 lg:pt-3">
          <div
            className="inline-flex rounded-full border border-white/15 bg-black/20 p-0.5 backdrop-blur-sm lg:border-white/10 lg:bg-black/25 lg:p-1 lg:shadow-inner lg:shadow-black/40"
            role="group"
            aria-label={t("music.home.bgMode")}
          >
            <button
              type="button"
              onClick={() => {
                setBgMode("images");
                if (imageBgs.length > 1) {
                  setImagePoolIdx(randomPoolIndex(imageBgs.length));
                }
              }}
              className={`rounded-full px-3 py-1.5 transition lg:px-4 lg:py-2 ${
                bgMode === "images"
                  ? "bg-white/20 text-white lg:bg-white/[0.18] lg:shadow-sm lg:shadow-black/30"
                  : "text-white/55 hover:text-white/80"
              }`}
            >
              {t("music.home.bgImages")}
            </button>
            <button
              type="button"
              onClick={() => setBgMode("ambient")}
              className={`rounded-full px-3 py-1.5 transition lg:px-4 lg:py-2 ${
                bgMode === "ambient"
                  ? "bg-white/20 text-white lg:bg-white/[0.18] lg:shadow-sm lg:shadow-black/30"
                  : "text-white/55 hover:text-white/80"
              }`}
            >
              {t("music.home.bgAmbient")}
            </button>
          </div>
          {bgMode === "ambient" ? (
            <div
              className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 px-2 pt-1.5 lg:gap-x-3.5 lg:pt-2"
              role="group"
              aria-label={t("music.home.ambientPicker")}
            >
              {HOME_ATMOSPHERE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setHomeAtmospherePresetId(p.id);
                    replaceAtmosphereSearchParam(p.id);
                  }}
                  aria-current={homeAtmospherePresetId === p.id ? "true" : undefined}
                  className={`px-1 py-0.5 text-[10px] font-normal tracking-[0.14em] transition ${
                    homeAtmospherePresetId === p.id
                      ? "text-white/[0.72]"
                      : "text-white/[0.32] hover:text-white/[0.48]"
                  }`}
                >
                  {t(`music.atmosphere.${p.id}`)}
                </button>
              ))}
            </div>
          ) : null}
          {showImageBackdrop ? (
            <div ref={imgFxRootRef} className="flex w-full max-w-[17rem] flex-col items-center gap-2 lg:max-w-xl xl:max-w-2xl">
              <div className="flex items-center justify-center gap-3">
                {imageBgs.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => shuffleImage()}
                    aria-label={t("music.home.shuffleBg")}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-sm text-white/75 backdrop-blur-sm transition hover:bg-white/[0.12] active:scale-[0.98] lg:h-10 lg:w-10"
                  >
                    ↻
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setImgFxOpen((o) => !o)}
                  aria-expanded={imgFxOpen}
                  aria-controls="music-img-fx-panel"
                  className="px-2 py-1 text-[10px] font-normal tracking-[0.14em] text-white/35 transition hover:text-white/55 lg:text-[11px]"
                >
                  {imgFxOpen ? t("music.home.panelOpen") : t("music.home.panelClosed")}
                </button>
              </div>
              {imgFxOpen ? (
                <div
                  id="music-img-fx-panel"
                  className="w-full space-y-2 border-t border-white/[0.06] pt-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-white/38">
                      <span>{t("music.home.blur")}</span>
                      <span className="tabular-nums">{imgBlurPx.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={0.5}
                      value={imgBlurPx}
                      onChange={(e) => setImgBlurPx(Number(e.target.value))}
                      className="h-1 w-full cursor-pointer accent-white/40"
                      aria-label={t("music.home.blur")}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-white/38">
                      <span>{t("music.home.opacity")}</span>
                      <span className="tabular-nums">{Math.round(imgOpacity * 100)}</span>
                    </div>
                    <input
                      type="range"
                      min={35}
                      max={100}
                      step={1}
                      value={Math.round(imgOpacity * 100)}
                      onChange={(e) => setImgOpacity(Number(e.target.value) / 100)}
                      className="h-1 w-full cursor-pointer accent-white/40"
                      aria-label={t("music.home.opacity")}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-white/38">
                      <span>{t("music.home.dim")}</span>
                      <span className="tabular-nums">{Math.round(imgDim * 100)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={55}
                      step={1}
                      value={Math.round(imgDim * 100)}
                      onChange={(e) => setImgDim(Number(e.target.value) / 100)}
                      className="h-1 w-full cursor-pointer accent-white/40"
                      aria-label={t("music.home.dim")}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-white/38">
                      <span>{t("music.home.saturation")}</span>
                      <span className="tabular-nums">{Math.round(imgSaturate * 100)}</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={120}
                      step={1}
                      value={Math.round(imgSaturate * 100)}
                      onChange={(e) => setImgSaturate(Number(e.target.value) / 100)}
                      className="h-1 w-full cursor-pointer accent-white/40"
                      aria-label={t("music.home.saturation")}
                    />
                  </div>
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      className="text-[10px] text-white/30 transition hover:text-white/45"
                      onClick={() => {
                        setImgOpacity(1);
                        setImgDim(0);
                        setImgSaturate(1);
                        setImgBlurPx(displayBg?.type === "image" && displayBg.blur ? 8 : 0);
                      }}
                    >
                      {t("music.home.resetFx")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </footer>
      </div>
    </div>
  );
}
