"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { GoldenVersesChromelessProvider, useGoldenVersesChromeless } from "@/components/verse/GoldenVersesChromelessContext";
import { GoldenVersesClient } from "@/components/verse/GoldenVersesClient";
import { GoldenVersesTopActions } from "@/components/verse/GoldenVersesTopActions";
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";

type Props = {
  goldenBackgroundImageUrl: string | null;
};

/**
 * 与 `NatureVideoExperience` 主视频槽同源类名：高度由 `[data-app-shell-scroll]` 量高（与底栏槽一致），
 * 媒体 `object-cover` 全幅无页边距；角标式壳层控件浮动在上。
 */
const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden bg-canvas transform-gpu min-h-[12rem]";

const NATURE_BG_COVER_MEDIA =
  "absolute left-0 top-1/2 z-[1] h-full min-h-full w-full min-w-full -translate-y-1/2 border-0 object-cover object-left outline-none sm:left-1/2 sm:-translate-x-1/2 sm:object-center";

function GoldenVersesNatureLikeStage({ imageSrc }: { imageSrc: string }) {
  const { chromeless } = useGoldenVersesChromeless();

  const [stageHeightPx, setStageHeightPx] = useState(0);
  const stageHeightCommitRef = useRef(0);

  useLayoutEffect(() => {
    if (chromeless) return;
    const root = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
    if (!root) return;

    let debounceId: number | null = null;

    const applyHeight = () => {
      const h = readAppShellScrollContentBoxClientHeight(root);
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
  }, [chromeless]);

  const stageShellStyle: CSSProperties = useMemo(
    () => ({
      height: chromeless
        ? "100dvh"
        : stageHeightPx > 0
          ? `${stageHeightPx}px`
          : "calc(100dvh - var(--home-bottom-nav-slot))",
    }),
    [chromeless, stageHeightPx],
  );

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-canvas text-ink [color-scheme:light]">
      {!chromeless ? (
        <AppShellTopBar
          tone="onLight"
          landscapeImmersive={false}
          rightAccessory={<GoldenVersesTopActions layout="inline" />}
        />
      ) : null}

      <div className={NATURE_VIDEO_STAGE_FRAME} style={stageShellStyle}>
        {!chromeless ? (
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-300/25 via-teal-950/15 to-transparent"
            aria-hidden
          />
        ) : null}
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
        <div className="pointer-events-none absolute inset-x-0 top-[38.2%] z-[12] flex -translate-y-1/2 justify-center px-5 sm:px-6 [@media(max-height:500px)_and_(orientation:portrait)]:top-[32%]">
          <div className="pointer-events-auto flex w-full justify-center">
            <GoldenVersesClient layout="shellFullBleed" />
          </div>
        </div>
      </div>

      {chromeless ? <GoldenVersesTopActions layout="floating" /> : null}
    </div>
  );
}

function GoldenVersesPlainShell() {
  const { chromeless } = useGoldenVersesChromeless();

  return (
    <>
      <ShellTemplateChromeLayout
        contentClassName="gap-0"
        immersive={chromeless}
        topBarRightAccessory={chromeless ? null : <GoldenVersesTopActions layout="inline" />}
        topBarTone="onLight"
      >
        <GoldenVersesClient />
      </ShellTemplateChromeLayout>
      {chromeless ? <GoldenVersesTopActions layout="floating" /> : null}
    </>
  );
}

function GoldenVersesPageClientInner({ goldenBackgroundImageUrl }: Props) {
  if (goldenBackgroundImageUrl) {
    return <GoldenVersesNatureLikeStage imageSrc={goldenBackgroundImageUrl} />;
  }
  return <GoldenVersesPlainShell />;
}

export function GoldenVersesPageClient(props: Props) {
  return (
    <GoldenVersesChromelessProvider>
      <GoldenVersesPageClientInner {...props} />
    </GoldenVersesChromelessProvider>
  );
}
