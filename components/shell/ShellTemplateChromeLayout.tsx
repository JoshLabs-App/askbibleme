"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { useShellTemplateDockPreviewOptional } from "@/components/shell/ShellTemplateDockPreviewContext";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useShellChromeScrimVisuals } from "@/hooks/useShellChromeScrimVisuals";
import {
  shellTemplatePreviewCssVars,
  shellTemplatePreviewThemeById,
  type ShellTemplateChromeTune,
} from "@/lib/shell/template-preview-themes";

/** 与 `AppShellTopBar` header：`pt` + 44px 行 + `pb` + 少量空隙 */
const MAIN_PT_CLEAR_TOP_BAR =
  "pt-[calc(max(2.125rem,calc(env(safe-area-inset-top,0px)+1.5rem))+2.75rem+0.375rem+0.25rem)] sm:pt-[calc(max(2.375rem,calc(env(safe-area-inset-top,0px)+1.75rem))+2.75rem+0.5rem+0.25rem)]";

export type ShellTemplateChromeLayoutProps = {
  children: ReactNode;
  /**
   * 不传时：使用本机已保存的压边参数（与首页自然场景同源；在管理后台「系统 → 壳层压边」调节）。
   * 传入受控值：保存前本地预览（写入仍由调用方调 `writeShellTemplateChromeTuneToStorage`）。
   */
  chromeTune?: ShellTemplateChromeTune;
  /** 加在预置内容列容器上，默认 `gap-6` */
  contentClassName?: string;
  /** 供 `ShellTemplateDesignReference` 等从 `--brand-*` 取样；不传则不挂 ref */
  sampleRootRef?: RefObject<HTMLDivElement | null>;
  /**
   * 为 true：不渲染 `AppShellTopBar`、不占顶栏留白，主区横向贴边；主区高度随 `(app-shell)` 主列铺满（底栏仍由壳层固定）。
   */
  immersive?: boolean;
  /** 为 true 时嵌入后台预览框：底压边相对 `main` 定位、不占满视口，且不写 `[data-app-shell-scroll]` 衬底色。 */
  embedPreview?: boolean;
};

/**
 * 与 `/template` 同源的主区壳：浅色衬底、顶/底 scrim、`--brand-*` 预览变量、滚动区衬底同步、底栏 dock 色。
 * 顶/底压边样式由 `useShellChromeScrimVisuals` 统一计算（管理后台「壳层压边」保存一次，与自然首页、旅程等共用同一套 tune + 渐变）。
 * 业务页只放内容，勿再自写一套 `main`/渐变/顶栏留白。
 *
 * `AppShellTopBar` 依赖 `HomeDockChromeProvider`；`/music` 等在 `(app-shell)` 外时，在此内嵌一层 Provider
 *（与 `(app-shell)` 内已有外层 Provider 并存时，仅本壳 subtree 使用内层，不影响自然首页 `DockChromeCollapse`）。
 */
export function ShellTemplateChromeLayout({
  children,
  chromeTune: chromeTuneProp,
  contentClassName = "gap-6",
  sampleRootRef,
  immersive = false,
  embedPreview = false,
}: ShellTemplateChromeLayoutProps) {
  const landscapeNarrow = useLandscapeNarrow();
  const { shellTemplateBrand } = useAppSkin();
  const previewThemeId = shellTemplateBrand ?? "lagoonPaper";
  const theme = shellTemplatePreviewThemeById(previewThemeId);
  const dockPreview = useShellTemplateDockPreviewOptional();

  const { chrome, topLayerStyle, bottomLayerStyleShellTemplateMain } = useShellChromeScrimVisuals(
    theme.colors.appLight,
    theme.colors.appDark,
    chromeTuneProp,
    embedPreview ? { shellMainBottomScrim: "contained" } : undefined,
  );

  useEffect(() => {
    if (!dockPreview) return;
    dockPreview.setTemplateDockHex(theme.colors.appDark);
    return () => dockPreview.setTemplateDockHex(null);
  }, [theme.colors.appDark, dockPreview]);

  useLayoutEffect(() => {
    if (embedPreview) return;
    const el = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
    if (!el) return;
    const prev = el.style.backgroundColor;
    el.style.backgroundColor = chrome.fillBackgroundColor;
    return () => {
      if (prev) el.style.backgroundColor = prev;
      else el.style.removeProperty("background-color");
    };
  }, [chrome.fillBackgroundColor, embedPreview]);

  const mainStyle: CSSProperties = useMemo(
    () => ({
      ...(immersive
        ? {}
        : embedPreview
          ? { minHeight: 0, height: "100%", flex: 1 }
          : {
              minHeight: "calc(100dvh - var(--home-bottom-nav-slot, 70px))",
            }),
      position: "relative",
      backgroundColor: chrome.fillBackgroundColor,
      ...(embedPreview ? { overflow: "hidden", display: "flex", flexDirection: "column" } : {}),
    }),
    [chrome.fillBackgroundColor, immersive, embedPreview],
  );

  const previewVars = useMemo(() => shellTemplatePreviewCssVars(theme), [theme]);

  const mainPadClass = immersive
    ? "overflow-hidden pb-0 pl-0 pr-0 pt-[env(safe-area-inset-top,0px)]"
    : embedPreview
      ? `min-h-0 overflow-hidden pb-6 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] ${MAIN_PT_CLEAR_TOP_BAR}`
      : `overflow-visible pb-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] ${MAIN_PT_CLEAR_TOP_BAR}`;

  const mainMinClass = embedPreview ? "min-h-0 h-full flex-1" : immersive ? "min-h-0 flex-1" : "";

  const bottomScrimClass = embedPreview
    ? "pointer-events-none absolute inset-x-0 bottom-0 z-[15] w-full"
    : "pointer-events-none fixed inset-x-0 z-[15] w-full";

  return (
    <HomeDockChromeProvider>
      <main
        className={`relative isolate flex w-full min-w-0 flex-col ${mainMinClass} ${!immersive && !embedPreview ? "min-h-full" : ""} ${mainPadClass}`}
        style={mainStyle}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[6] w-full"
          style={topLayerStyle}
        />
        <div aria-hidden className={bottomScrimClass} style={bottomLayerStyleShellTemplateMain} />
        <div
          ref={sampleRootRef}
          className={`relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col ${immersive ? "pb-0" : "pb-2"} ${embedPreview ? "min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]" : ""} ${contentClassName}`}
          style={previewVars as CSSProperties}
        >
          {children}
        </div>
        {immersive ? null : (
          <AppShellTopBar tone="onLight" landscapeImmersive={landscapeNarrow} />
        )}
      </main>
    </HomeDockChromeProvider>
  );
}
