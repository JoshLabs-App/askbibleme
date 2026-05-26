"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { NatureSceneLayer } from "@/components/nature/NatureSceneLayer";
import { ScenesPageListenShortcuts } from "@/components/nature/ScenesPageListenShortcuts";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import {
  defaultNatureHomeActiveVideoId,
  resolveNatureHomeActiveVideoId,
  writeNatureHomeActiveSceneId,
} from "@/lib/home/nature-home-active-scene-prefs";
import { SCENES_PAGE_SURFACE_STYLE } from "@/lib/nature/scenes-page-surface";
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";
import { ensureNatureVideoBlobObjectUrl, peekNatureVideoBlobObjectUrl } from "@/lib/nature/nature-video-blob-cache";
import { resolveNatureVideoSrcForEntry } from "@/lib/nature/resolve-nature-playback";

type Props = {
  initial: NatureSettingsV2;
  /** 选场景后返回的自然首页路径（电视壳为 `/tv`） */
  afterSelectHomePath?: string;
};

const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden transform-gpu min-h-[12rem]";

/** 场景选择：静态渐变底 + 构建期 settings，无背景视频、无运行时拉配置。 */
export function NatureScenesPickerPage({ initial, afterSelectHomePath = "/" }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const settings = initial;
  const [activeVideoId, setActiveVideoId] = useState(() => defaultNatureHomeActiveVideoId(initial));
  const [prepareSceneId, setPrepareSceneId] = useState<string | null>(null);
  const [prepareProgress, setPrepareProgress] = useState<number | null>(null);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const activeSceneHydratedRef = useRef(false);
  const videoStageHeightCommitRef = useRef(0);
  const [videoStageHeightPx, setVideoStageHeightPx] = useState(0);

  useLayoutEffect(() => {
    if (activeSceneHydratedRef.current) return;
    activeSceneHydratedRef.current = true;
    setActiveVideoId(resolveNatureHomeActiveVideoId(settings));
  }, [settings]);

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

  useLayoutEffect(() => {
    return () => {
      prepareAbortRef.current?.abort();
      prepareAbortRef.current = null;
    };
  }, []);

  const onSceneCardPress = useCallback(
    (id: string) => {
      const next = id.trim();
      if (!next || prepareSceneId) return;

      const row = settings.videos.find((v) => v.id.trim() === next);
      const videoSrc = row ? resolveNatureVideoSrcForEntry(row).trim() : "";
      if (!videoSrc) return;

      writeNatureHomeActiveSceneId(next);
      setActiveVideoId(next);

      if (peekNatureVideoBlobObjectUrl(videoSrc)) {
        router.push(afterSelectHomePath);
        return;
      }

      prepareAbortRef.current?.abort();
      const ac = new AbortController();
      prepareAbortRef.current = ac;
      setPrepareSceneId(next);
      setPrepareProgress(0);

      void (async () => {
        try {
          await ensureNatureVideoBlobObjectUrl(videoSrc, ac.signal, (received, totalBytes) => {
            if (totalBytes != null && totalBytes > 0) {
              setPrepareProgress(Math.min(1, received / totalBytes));
            } else {
              setPrepareProgress(null);
            }
          });
          if (ac.signal.aborted) return;
          setPrepareSceneId(null);
          setPrepareProgress(null);
          router.push(afterSelectHomePath);
        } catch {
          if (!ac.signal.aborted) {
            setPrepareSceneId(null);
            setPrepareProgress(null);
          }
        } finally {
          if (prepareAbortRef.current === ac) {
            prepareAbortRef.current = null;
          }
        }
      })();
    },
    [afterSelectHomePath, prepareSceneId, router, settings.videos],
  );

  const videoStageShellStyle: CSSProperties = useMemo(
    () => ({
      position: "relative",
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[14] flex max-h-[min(58dvh,72svh)] min-h-0 flex-col justify-end px-4 pb-[max(4.75rem,calc(env(safe-area-inset-bottom,0px)+4.25rem))] pt-1 sm:px-6 sm:pb-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] md:px-8 xl:px-10">
          <div className="pointer-events-auto mx-auto flex w-full min-h-0 max-w-lg flex-col items-stretch gap-4 overflow-y-auto overscroll-y-contain px-1 pb-1 sm:max-w-xl sm:px-2 md:max-w-3xl lg:max-w-none">
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
                  prepareSceneId={prepareSceneId}
                  prepareProgress={prepareProgress}
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
