"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { NatureSceneLayer } from "@/components/nature/NatureSceneLayer";
import { ScenesPageListenShortcuts } from "@/components/nature/ScenesPageListenShortcuts";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import {
  resolveNatureHomeActiveVideoId,
  writeNatureHomeActiveSceneId,
} from "@/lib/home/nature-home-active-scene-prefs";
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";

type Props = { initial: NatureSettingsV2 };

/** 场景页整屏底：在 `--brand-app-dark` 上做轻高光顶 + 略压暗底，与顶栏同色带衔接 */
const SCENES_PAGE_SURFACE_STYLE: CSSProperties = {
  backgroundColor: "rgb(var(--brand-app-dark-rgb))",
  backgroundImage:
    "linear-gradient(168deg, color-mix(in srgb, rgb(var(--brand-app-dark-rgb)) 88%, #ffffff 9%) 0%, rgb(var(--brand-app-dark-rgb)) 38%, color-mix(in srgb, rgb(var(--brand-app-dark-rgb)) 54%, #000000 46%) 100%)",
};

/** 与自然首页同构的舞台框；底色由 `SCENES_PAGE_SURFACE_STYLE` 注入 */
const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden transform-gpu min-h-[12rem]";

export function NatureScenesPickerPage({ initial }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [activeVideoId, setActiveVideoId] = useState(() => resolveNatureHomeActiveVideoId(initial));
  const videoStageHeightCommitRef = useRef(0);
  const [videoStageHeightPx, setVideoStageHeightPx] = useState(0);

  useEffect(() => {
    setSettings(initial);
    setActiveVideoId(resolveNatureHomeActiveVideoId(initial));
  }, [initial]);

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
    if (!root) return;

    let debounceId: number | null = null;

    const applyHeight = () => {
      const readH = readAppShellScrollContentBoxClientHeight(root);
      if (readH <= 0) return;
      const vvH = typeof window !== "undefined" ? window.visualViewport?.height ?? 0 : 0;
      const innerH = typeof window !== "undefined" ? window.innerHeight : 0;
      const h = Math.max(readH, vvH || 0, innerH || 0);
      const prev = videoStageHeightCommitRef.current;
      if (prev !== 0 && Math.abs(h - prev) < 12) return;
      videoStageHeightCommitRef.current = h;
      setVideoStageHeightPx(h);
    };

    const schedule = () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = null;
        applyHeight();
      }, 140);
    };

    applyHeight();
    requestAnimationFrame(() => applyHeight());

    const ro = new ResizeObserver(() => schedule());
    ro.observe(root);
    const onWin = () => schedule();
    window.addEventListener("resize", onWin);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", onWin);
      vv.addEventListener("scroll", onWin);
    }
    return () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      if (vv) {
        vv.removeEventListener("resize", onWin);
        vv.removeEventListener("scroll", onWin);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/nature/settings", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as NatureSettingsV2 | null;
        if (
          cancelled ||
          !data ||
          data.version !== 2 ||
          !Array.isArray(data.videos) ||
          !Array.isArray(data.ambientClips)
        ) {
          return;
        }
        setSettings(data);
        setActiveVideoId((prev) => {
          const ids = new Set(data.videos.map((v) => v.id.trim()).filter(Boolean));
          const p = prev.trim();
          if (p && ids.has(p)) return prev;
          return resolveNatureHomeActiveVideoId(data);
        });
      } catch {
        /* 离线等 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSceneCardPress = useCallback(
    (id: string) => {
      const next = id.trim();
      if (!next) return;
      if (next !== activeVideoId.trim()) {
        writeNatureHomeActiveSceneId(next);
        setActiveVideoId(next);
      }
      router.push("/");
    },
    [activeVideoId, router],
  );

  const videoStageShellStyle: CSSProperties = useMemo(
    () => ({
      ...SCENES_PAGE_SURFACE_STYLE,
      height:
        videoStageHeightPx > 0
          ? `${videoStageHeightPx}px`
          : "max(100dvh, 100svh, 100vh)",
    }),
    [videoStageHeightPx],
  );

  return (
    <div
      className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden text-white [color-scheme:dark]"
      style={SCENES_PAGE_SURFACE_STYLE}
    >
      <AppShellTopBar
        tone="onDark"
        landscapeImmersive={false}
        showTopInsetTime={false}
        hideTopShellInsetTime
      />

      <div className={NATURE_VIDEO_STAGE_FRAME} style={videoStageShellStyle}>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[14] flex max-h-[min(58dvh,68svh)] min-h-0 flex-col justify-end px-4 pb-[max(4.75rem,calc(env(safe-area-inset-bottom,0px)+4.25rem))] pt-1 sm:px-6 sm:pb-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] md:px-8 xl:px-10">
          <div className="pointer-events-auto mx-auto flex w-full min-h-0 max-w-lg flex-col items-stretch gap-5 overflow-y-auto overscroll-y-contain px-1 pb-1 sm:max-w-xl sm:px-2 md:max-w-3xl lg:max-w-none">
            <div
              className="@container relative w-full shrink-0"
              role="region"
              aria-label={t("scenesPage.sectionScenes")}
            >
              {settings.videos.length ? (
                <NatureSceneLayer
                  className="mt-0 w-full shrink-0 sm:mt-0.5 [@media(max-height:500px)]:mt-0 [@media(max-height:500px)]:sm:mt-0.5"
                  settings={settings}
                  activeVideoId={activeVideoId}
                  prepareSceneId={null}
                  prepareProgress={null}
                  onSceneCardPress={onSceneCardPress}
                />
              ) : (
                <p className="rounded-xl bg-black/35 px-3 py-3 text-center text-[12px] leading-relaxed text-white/70 ring-1 ring-white/10 sm:text-[13px]">
                  {t("scenesPage.emptyInline")}
                </p>
              )}
            </div>

            <ScenesPageListenShortcuts />
          </div>
        </div>
      </div>
    </div>
  );
}
