"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { GoldenVersesClient } from "@/components/verse/GoldenVersesClient";
import { GoldenVersesSettingsTopBar } from "@/components/verse/GoldenVersesSettingsTopBar";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { useShellChromeScrimVisuals } from "@/hooks/useShellChromeScrimVisuals";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { shellTemplatePreviewThemeById } from "@/lib/shell/template-preview-themes";

type Props = {
  fallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
  goldenBackgroundImageUrl: string | null;
};

/**
 * 与 `NatureVideoExperience` 主视频槽同源类名：高度由 `[data-app-shell-scroll]` 量高（与底栏槽一致），
 * 媒体 `object-cover` 全幅无页边距，顶栏浮动在上。
 */
const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden bg-canvas transform-gpu min-h-[12rem]";

const NATURE_BG_COVER_MEDIA =
  "absolute left-0 top-1/2 z-[1] h-full min-h-full w-full min-w-full -translate-y-1/2 border-0 object-cover object-left outline-none sm:left-1/2 sm:-translate-x-1/2 sm:object-center";

function GoldenVersesNatureLikeStage({ imageSrc, fallbackByLocale }: { imageSrc: string; fallbackByLocale: Props["fallbackByLocale"] }) {
  const { shellTemplateBrand } = useAppSkin();
  const scrimBrandChrome = useMemo(() => {
    if (shellTemplateBrand) {
      const c = shellTemplatePreviewThemeById(shellTemplateBrand).colors;
      return { appLight: c.appLight, appDark: c.appDark };
    }
    return { appLight: "#e8f0f0", appDark: "#0b1a1c" };
  }, [shellTemplateBrand]);

  const { topLayerStyle, bottomLayerStyleNatureVideoStage } = useShellChromeScrimVisuals(
    scrimBrandChrome.appLight,
    scrimBrandChrome.appDark,
  );

  const [stageHeightPx, setStageHeightPx] = useState(0);
  const stageHeightCommitRef = useRef(0);

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
    if (!root) return;

    let debounceId: number | null = null;

    const applyHeight = () => {
      const h = Math.round(root.clientHeight);
      if (h <= 0) return;
      const prev = stageHeightCommitRef.current;
      if (prev !== 0 && Math.abs(h - prev) < 12) return;
      stageHeightCommitRef.current = h;
      setStageHeightPx(h);
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
    }
    return () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      if (vv) {
        vv.removeEventListener("resize", onWin);
      }
    };
  }, []);

  const stageShellStyle: CSSProperties = useMemo(
    () => ({
      height:
        stageHeightPx > 0 ? `${stageHeightPx}px` : "calc(100dvh - var(--home-bottom-nav-slot))",
    }),
    [stageHeightPx],
  );

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-canvas text-ink [color-scheme:light]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[6] w-full"
        style={topLayerStyle}
        aria-hidden
      />

      <AppShellTopBar
        tone="onLight"
        landscapeImmersive={false}
        rightAccessory={<GoldenVersesSettingsTopBar variant="light" />}
      />

      <div className={NATURE_VIDEO_STAGE_FRAME} style={stageShellStyle}>
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-300/25 via-teal-950/15 to-transparent"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element -- 与首页视频层同源构图，须与 `NATURE_BG_COVER_MEDIA` 一致 */}
          <img
            src={imageSrc}
            alt=""
            decoding="async"
            fetchPriority="high"
            className={NATURE_BG_COVER_MEDIA}
            style={{ maxWidth: "none" }}
            aria-hidden
          />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] w-full"
          style={bottomLayerStyleNatureVideoStage}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 top-[38.2%] z-[12] flex -translate-y-1/2 justify-center px-5 sm:px-6 [@media(max-height:500px)_and_(orientation:portrait)]:top-[32%]">
          <div className="pointer-events-auto flex w-full justify-center">
            <GoldenVersesClient fallbackByLocale={fallbackByLocale} layout="shellFullBleed" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoldenVersesPageClient({ fallbackByLocale, goldenBackgroundImageUrl }: Props) {
  if (goldenBackgroundImageUrl) {
    return (
      <GoldenVersesNatureLikeStage imageSrc={goldenBackgroundImageUrl} fallbackByLocale={fallbackByLocale} />
    );
  }

  return (
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      topBarRightAccessory={<GoldenVersesSettingsTopBar variant="light" />}
      topBarTone="onLight"
    >
      <GoldenVersesClient fallbackByLocale={fallbackByLocale} />
    </ShellTemplateChromeLayout>
  );
}
