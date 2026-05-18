"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { HomeVerseTypographyTopAccessory } from "@/components/home/HomeVerseTypographyTopAccessory";
import { NatureSceneLayer } from "@/components/nature/NatureSceneLayer";
import { ScenesPageListenShortcuts } from "@/components/nature/ScenesPageListenShortcuts";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX,
  NATURE_HOME_TEXT_SCALE_STEPS,
  natureHomeTextScaleAtStep,
  readNatureHomeTextScaleStepIndex,
  writeNatureHomeTextScaleStepIndex,
} from "@/lib/home/nature-home-text-scale-prefs";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import {
  defaultNatureHomeActiveVideoId,
  resolveNatureHomeActiveVideoId,
  writeNatureHomeActiveSceneId,
} from "@/lib/home/nature-home-active-scene-prefs";
import { SCENES_PAGE_SURFACE_STYLE } from "@/lib/nature/scenes-page-surface";
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";

type Props = { initial: NatureSettingsV2 };

const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden transform-gpu min-h-[12rem]";

/** 场景选择：静态渐变底 + 构建期 settings，无背景视频、无运行时拉配置。 */
export function NatureScenesPickerPage({ initial }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const settings = initial;
  const [activeVideoId, setActiveVideoId] = useState(() => defaultNatureHomeActiveVideoId(initial));
  const activeSceneHydratedRef = useRef(false);
  const videoStageHeightCommitRef = useRef(0);
  const [videoStageHeightPx, setVideoStageHeightPx] = useState(0);
  const [verseTextScaleStepIndex, setVerseTextScaleStepIndex] = useState(NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX);

  useLayoutEffect(() => {
    setVerseTextScaleStepIndex(readNatureHomeTextScaleStepIndex());
  }, []);

  const verseTextZoom = natureHomeTextScaleAtStep(verseTextScaleStepIndex);
  const natureVerseTextScale = useMemo(
    () => ({
      atMin: verseTextScaleStepIndex <= 0,
      atMax: verseTextScaleStepIndex >= NATURE_HOME_TEXT_SCALE_STEPS.length - 1,
      onSmaller: () => {
        setVerseTextScaleStepIndex((prev) => {
          const next = Math.max(0, prev - 1);
          writeNatureHomeTextScaleStepIndex(next);
          return next;
        });
      },
      onLarger: () => {
        setVerseTextScaleStepIndex((prev) => {
          const next = Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, prev + 1);
          writeNatureHomeTextScaleStepIndex(next);
          return next;
        });
      },
    }),
    [verseTextScaleStepIndex],
  );

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
        rightAccessory={<HomeVerseTypographyTopAccessory tone="onDark" natureVerseTextScale={natureVerseTextScale} />}
      />

      <div className={NATURE_VIDEO_STAGE_FRAME} style={videoStageShellStyle}>
        {/* 与自然首页 `NatureVideoExperience` 一致：经文块中心落在主区垂直黄金分割点 */}
        <div
          className={[
            "pointer-events-none absolute inset-x-0 top-[38.2%] z-[12]",
            "flex max-h-[min(52dvh,calc(100%-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-11rem))]",
            "-translate-y-1/2 flex-col items-center justify-center overflow-hidden px-5 sm:px-6",
            "[@media(max-height:500px)_and_(orientation:portrait)]:top-[32%]",
            "landscape:max-h-[min(44dvh,calc(100%-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-9.5rem))]",
          ].join(" ")}
        >
          <div className="mx-auto flex min-w-0 max-w-full justify-center text-center" style={{ zoom: verseTextZoom }}>
            <HomeVerseRotator
              variant="dark"
              prominence="nature"
              className="w-full min-h-[6.5rem] sm:min-h-[7.5rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[4rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[4.25rem]"
            />
          </div>
        </div>
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