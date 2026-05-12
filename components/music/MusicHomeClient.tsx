"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LagoonBreatheOrb } from "@/components/calm/LagoonBreatheOrb";
import { AmbientBackdrop } from "@/components/music/AmbientBackdrop";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import {
  writeStoredMusicHomeAtmosphere,
  type HomeAtmospherePresetId,
  useMusicShellAtmosphereOverride,
} from "@/music-visual";
import type { AudioTrack, MusicCompanionStore, Scene } from "@/lib/music-companion/types";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { landscapeNarrowMedia as ln } from "@/lib/ui/landscape-tailwind";

type Props = {
  initialStore: MusicCompanionStore;
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

/** 与壳层默认池一致：多曲随机下标；单曲为 0 */
function computeRandomTrackPoolIdx(store: MusicCompanionStore): number {
  const tracks = store.audioTracks.filter((t) => t.src?.trim());
  if (tracks.length <= 1) return 0;
  return Math.floor(Math.random() * tracks.length);
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

export function MusicHomeClient({ initialStore }: Props) {
  const { t } = useLocale();
  const landscapeNarrow = useLandscapeNarrow();
  const { setOverrideId, clearOverride } = useMusicShellAtmosphereOverride();
  const musicAtmosphereId: HomeAtmospherePresetId = "lagoon";

  useLayoutEffect(() => {
    writeStoredMusicHomeAtmosphere("lagoon");
  }, []);

  useLayoutEffect(() => {
    setOverrideId(musicAtmosphereId);
  }, [musicAtmosphereId, setOverrideId]);

  useLayoutEffect(() => {
    return () => {
      clearOverride();
    };
  }, [clearOverride]);

  const { currentSec, durationSec, seekRatio, setPlaybackSrc, effectiveSrc } = useMusicShellPlayback();
  const [store, setStore] = useState<MusicCompanionStore>(initialStore);
  const initialSi = initialSceneIndex(initialStore);
  const [sceneIndex, setSceneIndex] = useState(() => initialSi);
  const [trackPoolIdx, setTrackPoolIdx] = useState(() => computeRandomTrackPoolIdx(initialStore));
  const fullMusicSrcGateDone = useRef(false);
  /** 用户刚点上一首/下一首/随机：短时间内优先信任 trackPoolIdx，避免壳层 ended 已切歌而此处仍用旧 URL 把播放源推回去导致更新风暴 */
  const userSkipAtRef = useRef(0);
  const bumpUserSkip = () => {
    userSkipAtRef.current = typeof performance !== "undefined" ? performance.now() : 0;
  };
  const setPlaybackSrcRef = useRef(setPlaybackSrc);
  setPlaybackSrcRef.current = setPlaybackSrc;

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

  const defaultTrackPoolIdx = useMemo(() => {
    if (tracksWithSrc.length === 0) return 0;
    const want = scene?.audioTrackId ?? null;
    const i = want ? tracksWithSrc.findIndex((t) => t.id === want) : -1;
    return i >= 0 ? i : 0;
  }, [scene?.audioTrackId, scene?.id, tracksWithSrc]);

  const initialTrackCount = countTracksWithSrc(initialStore);
  const initialTrackCountRef = useRef(initialTrackCount);
  const prevSceneIdForPoolRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const n = tracksWithSrc.length;
    const wasN = initialTrackCountRef.current;
    if (wasN <= 1 && n > 1) {
      initialTrackCountRef.current = n;
      setTrackPoolIdx(computeRandomTrackPoolIdx(store));
    }
  }, [tracksWithSrc.length, store, sceneIndex]);

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
    }
  }, [scene?.id, defaultTrackPoolIdx]);

  useEffect(() => {
    setTrackPoolIdx((i) =>
      tracksWithSrc.length === 0 ? 0 : Math.min(i, tracksWithSrc.length - 1),
    );
  }, [tracksWithSrc.length]);

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

  const lagoonLight = musicAtmosphereId === "lagoon";

  useEffect(() => {
    if (!landscapeNarrow) {
      document.documentElement.removeAttribute("data-landscape-immersive");
      return;
    }
    document.documentElement.setAttribute("data-landscape-immersive", "");
    return () => document.documentElement.removeAttribute("data-landscape-immersive");
  }, [landscapeNarrow]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    /** iOS：对 documentElement 自动全屏易触发系统回收 / 黑屏闪回（与自然页一致，仅用 CSS 沉浸）。 */
    if (isIosLikeUserAgent()) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    if (!landscapeNarrow) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    void requestFullscreenCompat(document.documentElement).catch(() => {});
  }, [landscapeNarrow]);

  return (
    <div
      className={
        lagoonLight
          ? "relative mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden bg-canvas text-ink shadow-xl shadow-sky-900/10 lg:mx-0 lg:h-full lg:max-h-none lg:min-h-0 lg:w-full lg:max-w-none lg:flex-1 lg:rounded-none lg:shadow-none lg:ring-0"
          : "relative mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden bg-ink text-canvas shadow-2xl lg:mx-0 lg:h-full lg:max-h-none lg:min-h-0 lg:w-full lg:max-w-none lg:flex-1 lg:rounded-none lg:shadow-none lg:ring-0"
      }
    >

      <div className="pointer-events-none absolute inset-0 z-0 isolate min-h-full min-w-full overflow-hidden music-reactive-home-shell">
        <AmbientBackdrop preset={musicAtmosphereId} />
        <div
          className={`pointer-events-none absolute inset-0 z-[2] flex items-center justify-center mix-blend-soft-light ${
            lagoonLight ? "opacity-[0.22]" : "opacity-[0.44]"
          }`}
          aria-hidden
        >
          <LagoonBreatheOrb />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-[3]" aria-hidden>
        {lagoonLight ? (
          <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-sky-50/40 to-sky-100/55 lg:from-white/45 lg:via-sky-100/35 lg:to-sky-100/50" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-black/[0.22] to-black/[0.5] lg:from-black/10 lg:via-black/20 lg:to-black/[0.46]" />
        )}
        {lagoonLight ? (
          <div className="absolute left-1/2 top-[min(30dvh,38%)] h-[min(92vw,34rem)] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(125,211,252,0.35)_0%,rgba(224,242,254,0.2)_40%,transparent_72%)]" />
        ) : (
          <div className="absolute left-1/2 top-[min(30dvh,38%)] h-[min(92vw,34rem)] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,200,160,0.16)_0%,rgba(230,160,105,0.055)_40%,transparent_70%)]" />
        )}
      </div>
      {/* 底部轻晕：读取 `--music-*`，与后台「光晕 / 深色光晕」同源；置于 z-[3] 渐变之上否则完全被盖住 */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[min(38vh,17rem)] bg-gradient-to-t ${
          lagoonLight
            ? "from-sky-300/30 via-cyan-100/12 to-transparent music-reactive-home-glow"
            : "from-black/45 via-black/14 to-transparent music-reactive-home-glow-dark"
        }`}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppShellTopBar tone={lagoonLight ? "onLight" : "onDark"} landscapeImmersive={landscapeNarrow} />

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${ln}:min-h-0 ${ln}:flex-row ${ln}:gap-2 ${ln}:px-2 ${ln}:pb-1`}
        >
          <div
            className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pt-[max(0.25rem,calc(env(safe-area-inset-top)+3.5rem))] ${ln}:min-w-0 ${ln}:overflow-y-auto ${ln}:pt-[max(0.15rem,calc(env(safe-area-inset-top)+0.4rem))]`}
          >
            <div
              className={`relative z-10 flex flex-col items-center justify-start px-4 pt-5 text-center sm:px-5 sm:pt-6 lg:px-6 lg:pt-7 xl:px-8 ${ln}:h-full ${ln}:justify-center ${ln}:px-3 ${ln}:py-3`}
            >
              <div className="flex w-full max-w-xl flex-col items-center lg:max-w-2xl">
                <div
                  className={`min-w-0 w-full pt-[clamp(1rem,12dvh,6rem)] opacity-0 motion-reduce:animate-none motion-reduce:opacity-100 animate-music-hero-fade ${ln}:pt-1 ${ln}:max-w-[min(100%,28rem)]`}
                >
          {tracksWithSrc.length > 1 ? (
            <button
              type="button"
              onClick={() => shuffleTrack()}
              aria-label={t("music.home.shuffleTrack")}
              className={`group w-full rounded-2xl px-2 py-4 text-center transition active:scale-[0.99] sm:px-3 lg:rounded-3xl lg:px-5 lg:py-7 lg:transition-colors ${
                lagoonLight ? "lg:hover:bg-ink/[0.04]" : "lg:hover:bg-white/[0.03]"
              }`}
            >
              <HomeVerseRotator
                variant={lagoonLight ? "light" : "dark"}
                className="min-h-[7rem] max-w-[19rem] sm:max-w-[21.5rem]"
              />
            </button>
          ) : (
            <>
              <HomeVerseRotator
                variant={lagoonLight ? "light" : "dark"}
                className="min-h-[7rem] max-w-[19rem] sm:max-w-[21.5rem]"
              />
            </>
          )}
          </div>
        </div>
        {!audioSrc ? (
          <p
            className={`mt-4 max-w-[16rem] text-xs leading-relaxed lg:max-w-md lg:text-sm ${
              lagoonLight ? "text-muted" : "text-amber-100/90"
            }`}
          >
            {t("music.home.noAudioBefore")}{" "}
            <Link href="/admin/music" className="underline underline-offset-2">
              {t("music.home.adminMusic")}
            </Link>{" "}
            {t("music.home.noAudioAfter")}
          </p>
        ) : null}
            </div>
          </div>

        <footer
          className={`relative z-10 mt-0 flex w-full shrink-0 flex-col items-stretch gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-xs lg:mx-auto lg:max-w-2xl lg:gap-4 lg:px-6 lg:pb-5 lg:pt-4 lg:text-[13px] xl:max-w-3xl xl:px-8 ${ln}:mx-0 ${ln}:max-w-none ${ln}:w-[min(13rem,36vw)] ${ln}:max-w-[42%] ${ln}:shrink-0 ${ln}:self-stretch ${ln}:justify-center ${ln}:gap-2 ${ln}:border-l ${ln}:px-3 ${ln}:py-2 ${ln}:pt-2 ${ln}:pb-[max(0.5rem,env(safe-area-inset-bottom))] ${ln}:pr-[max(0.25rem,env(safe-area-inset-right))] ${
            lagoonLight
              ? `text-ink/55 lg:text-ink/50 ${ln}:border-ink/12`
              : `text-white/55 lg:text-white/48 ${ln}:border-white/[0.12]`
          }`}
        >
        {audioSrc ? (
          <div
            className={`flex items-center gap-3.5 text-[11px] tabular-nums lg:text-[12px] ${
              lagoonLight ? "text-ink/50 lg:text-ink/45" : "text-white/[0.5] lg:text-white/45"
            }`}
          >
            <span className="min-w-[2.5rem] shrink-0">{formatTime(currentSec)}</span>
            <button
              type="button"
              aria-label={t("music.home.progress")}
              className={
                lagoonLight
                  ? "group relative h-[3px] flex-1 overflow-hidden rounded-full bg-ink/12 lg:h-[3px]"
                  : "group relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.1]"
              }
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - r.left;
                seekRatio(x / r.width);
              }}
            >
              <span
                className={
                  lagoonLight
                    ? "absolute inset-y-0 left-0 rounded-full bg-sand/90 shadow-[0_0_12px_rgba(61,138,184,0.35)] transition-[width] duration-150 ease-out group-hover:bg-sand group-hover:shadow-[0_0_16px_rgba(61,138,184,0.45)]"
                    : "absolute inset-y-0 left-0 rounded-full bg-white/[0.88] shadow-[0_0_14px_rgba(255,255,255,0.35),0_0_28px_rgba(255,245,230,0.12)] transition-[width] duration-150 ease-out group-hover:bg-white/[0.95] group-hover:shadow-[0_0_18px_rgba(255,255,255,0.42)]"
                }
                style={{
                  width: `${durationSec ? Math.min(100, (currentSec / durationSec) * 100) : 0}%`,
                }}
              />
            </button>
            <span className="min-w-[2.5rem] shrink-0 text-right">{formatTime(durationSec)}</span>
          </div>
        ) : null}

      </footer>
        </div>
      </div>
    </div>
  );
}
