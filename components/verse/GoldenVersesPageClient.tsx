"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { GoldenVersesChromelessProvider, useGoldenVersesChromeless } from "@/components/verse/GoldenVersesChromelessContext";
import { GoldenVersesClient } from "@/components/verse/GoldenVersesClient";
import { GoldenVersesTopActions } from "@/components/verse/GoldenVersesTopActions";
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";
import { useGoldenVersePageTemplateId } from "@/hooks/useGoldenVersePageTemplateId";
import { resolveGoldenVersePageTemplateImageUrl } from "@/lib/verse/golden-verse-page-templates";

type Props = {
  goldenBackgroundImageUrl: string | null;
};

type TopActionsExtras = {
  customBackgroundUrl: string | null;
};

/**
 * 与 `NatureVideoExperience` 主视频槽同源类名：高度由 `[data-app-shell-scroll]` 量高（与底栏槽一致），
 * 背图 `object-fill` 与读经羊皮卷 `background-size: 100% 100%` 一致，拉满舞台；角标式壳层控件浮动在上。
 */
const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden bg-canvas transform-gpu min-h-[12rem]";

const GOLDEN_VERSE_BG_FILL_MEDIA =
  "absolute inset-0 z-[1] h-full w-full border-0 object-fill object-center outline-none";

function GoldenVersesNatureLikeStage({
  imageSrc,
  topActionsExtras,
}: {
  imageSrc: string;
  topActionsExtras: TopActionsExtras;
}) {
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
          rightAccessory={
            <GoldenVersesTopActions layout="inline" customBackgroundUrl={topActionsExtras.customBackgroundUrl} />
          }
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
          {/* eslint-disable-next-line @next/next/no-img-element -- 上传背图须铺满舞台，与读经羊皮卷 100% 拉伸一致 */}
          <img
            src={imageSrc}
            alt=""
            decoding="async"
            fetchPriority="high"
            className={GOLDEN_VERSE_BG_FILL_MEDIA}
            aria-hidden
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-[38.2%] z-[12] flex -translate-y-1/2 justify-center px-5 sm:px-6 [@media(max-height:500px)_and_(orientation:portrait)]:top-[32%]">
          <div className="pointer-events-auto flex w-full justify-center">
            <GoldenVersesClient layout="shellFullBleed" />
          </div>
        </div>
      </div>

      {chromeless ? (
        <GoldenVersesTopActions layout="floating" customBackgroundUrl={topActionsExtras.customBackgroundUrl} />
      ) : null}
    </div>
  );
}

function GoldenVersesPlainShell({ topActionsExtras }: { topActionsExtras: TopActionsExtras }) {
  const { chromeless } = useGoldenVersesChromeless();

  return (
    <>
      <ShellTemplateChromeLayout
        contentClassName="gap-0"
        immersive={chromeless}
        topBarRightAccessory={
          chromeless ? null : (
            <GoldenVersesTopActions layout="inline" customBackgroundUrl={topActionsExtras.customBackgroundUrl} />
          )
        }
        topBarTone="onLight"
      >
        <GoldenVersesClient />
      </ShellTemplateChromeLayout>
      {chromeless ? (
        <GoldenVersesTopActions layout="floating" customBackgroundUrl={topActionsExtras.customBackgroundUrl} />
      ) : null}
    </>
  );
}

function GoldenVersesPageClientInner({ goldenBackgroundImageUrl }: Props) {
  const templateId = useGoldenVersePageTemplateId(goldenBackgroundImageUrl);
  const imageSrc = resolveGoldenVersePageTemplateImageUrl(templateId, goldenBackgroundImageUrl);

  const topActionsExtras: TopActionsExtras = useMemo(
    () => ({ customBackgroundUrl: goldenBackgroundImageUrl }),
    [goldenBackgroundImageUrl],
  );

  if (imageSrc) {
    return <GoldenVersesNatureLikeStage imageSrc={imageSrc} topActionsExtras={topActionsExtras} />;
  }
  return <GoldenVersesPlainShell topActionsExtras={topActionsExtras} />;
}

export function GoldenVersesPageClient(props: Props) {
  return (
    <GoldenVersesChromelessProvider>
      <GoldenVersesPageClientInner {...props} />
    </GoldenVersesChromelessProvider>
  );
}
