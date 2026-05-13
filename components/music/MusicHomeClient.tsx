"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import type { AudioTrack, MusicCompanionStore, Scene } from "@/lib/music-companion/types";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { HomeVerseRotatorWithPrayerPool } from "@/components/home/HomeVerseRotatorWithPrayerPool";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";
import { resolveLocalized } from "@/lib/i18n/localized-text";
import { landscapeNarrowMedia as ln } from "@/lib/ui/landscape-tailwind";

type Props = {
  initialStore: MusicCompanionStore;
  /**
   * `templateChrome`：外层已由 `ShellTemplateChromeLayout` 提供顶栏与主区衬底；轮播经文与首页自然层同源（`HomeVerseRotator` + `prominence="nature"`）。
   * 缺省为独立全屏音乐页（历史行为）。
   */
  layout?: "standalone" | "templateChrome";
  /** 由服务端从已导入译本解析的轮播经文 */
  homeVerseRotation?: Record<AppLocale, HomeVerseEntry[]>;
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

/** 与自然首页 `NatureVideoExperience` 中 `HomeVerseRotator` 同版心、同最小高度（浅色主区用 `variant="light"`） */
const MUSIC_HOME_VERSE_CLASS =
  "w-full min-h-[6.5rem] sm:min-h-[7.5rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[4rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[4.25rem]";

export function MusicHomeClient({ initialStore, layout = "standalone", homeVerseRotation }: Props) {
  const { t, locale } = useLocale();
  const { bootstrapped, user } = useAskbibleUser();
  const showAdminMusicLink = bootstrapped && Boolean(user && isSelahSuperAdminEmail(user.email));
  const landscapeNarrow = useLandscapeNarrow();
  const inTemplateChrome = layout === "templateChrome";

  const verseFallback = useMemo(
    () => homeVerseRotation ?? ({ "zh-CN": [], en: [] } as Record<AppLocale, HomeVerseEntry[]>),
    [homeVerseRotation],
  );

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

  const selectTrack = useCallback((idx: number) => {
    bumpUserSkip();
    setTrackPoolIdx(idx);
  }, []);

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
        inTemplateChrome
          ? "relative mx-auto flex min-h-0 min-w-0 w-full max-w-md flex-1 flex-col overflow-hidden text-ink lg:mx-0 lg:max-w-none"
          : "relative mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden bg-canvas text-ink lg:mx-0 lg:h-full lg:max-h-none lg:min-h-0 lg:w-full lg:max-w-none lg:flex-1 lg:rounded-none"
      }
    >
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!inTemplateChrome ? <AppShellTopBar tone="onLight" landscapeImmersive={landscapeNarrow} /> : null}

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${ln}:min-h-0 ${ln}:flex-row ${ln}:gap-2 ${ln}:px-2 ${ln}:pb-1`}
        >
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
              inTemplateChrome
                ? `pt-1 ${ln}:min-w-0 ${ln}:pt-[max(0.15rem,calc(env(safe-area-inset-top)+0.4rem))]`
                : `pt-[max(0.25rem,calc(env(safe-area-inset-top)+3.5rem))] ${ln}:min-w-0 ${ln}:pt-[max(0.15rem,calc(env(safe-area-inset-top)+0.4rem))]`
            }`}
          >
            <div
              className={`relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-5 lg:px-6 xl:px-8 ${ln}:px-3`}
            >
              <div
                className={`flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-y-contain text-center [-webkit-overflow-scrolling:touch] ${ln}:py-2`}
              >
                <div className="flex w-full max-w-lg flex-col items-center justify-center sm:max-w-xl lg:max-w-2xl landscape:max-w-[min(92vw,48rem)] lg:landscape:max-w-[min(85vw,54rem)]">
                  <div className="min-w-0 w-full px-0 pt-2 sm:pt-3">
                    {tracksWithSrc.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => shuffleTrack()}
                        aria-label={t("music.home.shuffleTrack")}
                        className="group w-full rounded-2xl px-2 py-4 text-center transition active:scale-[0.99] sm:px-3 lg:rounded-3xl lg:px-5 lg:py-7 lg:transition-colors lg:hover:bg-ink/[0.04]"
                      >
                        <HomeVerseRotatorWithPrayerPool
                          fallbackByLocale={verseFallback}
                          variant="light"
                          prominence="nature"
                          className={MUSIC_HOME_VERSE_CLASS}
                        />
                      </button>
                    ) : (
                      <HomeVerseRotatorWithPrayerPool
                        fallbackByLocale={verseFallback}
                        variant="light"
                        prominence="nature"
                        className={MUSIC_HOME_VERSE_CLASS}
                      />
                    )}
                  </div>
                </div>
              </div>

              {tracksWithSrc.length > 0 ? (
                <section className="mx-auto w-full max-w-md shrink-0 px-2 pb-2 pt-3 sm:max-w-lg">
                  <ul className="mx-auto max-h-[min(40dvh,20rem)] space-y-0.5 overflow-y-auto overscroll-y-contain text-center [-webkit-overflow-scrolling:touch]">
                    {tracksWithSrc.map((tr, idx) => {
                      const active = idx === resolvedTrackIdx;
                      const titleText =
                        resolveLocalized(tr.title, locale).trim() || t("music.home.trackUntitled");
                      const artistText = resolveLocalized(tr.artist, locale).trim();
                      const line = artistText ? `${titleText} · ${artistText}` : titleText;
                      return (
                        <li key={tr.id}>
                          <button
                            type="button"
                            onClick={() => selectTrack(idx)}
                            aria-current={active ? "true" : undefined}
                            className={[
                              "w-full max-w-full border-0 bg-transparent px-2 py-2.5 text-center transition-[color,font-size] motion-reduce:transition-none",
                              active
                                ? "text-[17px] font-medium leading-snug text-ink/20 sm:text-[18px]"
                                : "text-[16px] font-normal leading-snug text-ink/20 hover:text-ink/25 sm:text-[17px]",
                            ].join(" ")}
                          >
                            <span className="inline-block max-w-full whitespace-normal break-words text-balance">
                              {line}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {!audioSrc ? (
                <p className="shrink-0 px-2 pb-3 pt-1 text-center text-xs leading-relaxed text-muted sm:text-sm">
                  {showAdminMusicLink ? (
                    <>
                      {t("music.home.noAudioBefore")}{" "}
                      <Link href="/admin/music" className="underline underline-offset-2">
                        {t("music.home.adminMusic")}
                      </Link>{" "}
                      {t("music.home.noAudioAfter")}
                    </>
                  ) : (
                    t("music.home.noAudioPlain")
                  )}
                </p>
              ) : null}
            </div>
          </div>

          <footer
            className={`relative z-10 mt-0 flex w-full shrink-0 flex-col items-stretch gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-xs text-ink/55 lg:mx-auto lg:max-w-2xl lg:gap-4 lg:px-6 lg:pb-5 lg:pt-4 lg:text-[13px] lg:text-ink/50 xl:max-w-3xl xl:px-8 ${ln}:mx-0 ${ln}:max-w-none ${ln}:w-[min(13rem,36vw)] ${ln}:max-w-[42%] ${ln}:shrink-0 ${ln}:self-stretch ${ln}:justify-center ${ln}:gap-2 ${ln}:border-l ${ln}:border-ink/12 ${ln}:px-3 ${ln}:py-2 ${ln}:pt-2 ${ln}:pb-[max(0.5rem,env(safe-area-inset-bottom))] ${ln}:pr-[max(0.25rem,env(safe-area-inset-right))]`}
          >
            {audioSrc ? (
              <div className="flex items-center gap-3.5 text-[11px] tabular-nums text-ink/50 lg:text-[12px] lg:text-ink/45">
                <span className="min-w-[2.5rem] shrink-0">{formatTime(currentSec)}</span>
                <button
                  type="button"
                  aria-label={t("music.home.progress")}
                  className="group relative h-[3px] flex-1 overflow-hidden rounded-full bg-ink/15 lg:h-[3px]"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - r.left;
                    seekRatio(x / r.width);
                  }}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-ink/70 transition-[width] duration-150 ease-out group-hover:bg-ink/85"
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
