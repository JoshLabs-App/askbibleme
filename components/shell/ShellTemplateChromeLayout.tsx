"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { useShellTemplateDockPreviewOptional } from "@/components/shell/ShellTemplateDockPreviewContext";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useShellTemplateChromeTuneFromStorage } from "@/hooks/useShellTemplateChromeTuneFromStorage";
import {
  shellTemplateChromeScrimBackgrounds,
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
};

/**
 * 与 `/template` 同源的主区壳：浅色衬底、顶/底 scrim、`--brand-*` 预览变量、滚动区衬底同步、底栏 dock 色。
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
}: ShellTemplateChromeLayoutProps) {
  const persistedChromeTune = useShellTemplateChromeTuneFromStorage();
  const chromeTune = chromeTuneProp !== undefined ? chromeTuneProp : persistedChromeTune;
  const landscapeNarrow = useLandscapeNarrow();
  const { shellTemplateBrand } = useAppSkin();
  const previewThemeId = shellTemplateBrand ?? "lagoonPaper";
  const theme = shellTemplatePreviewThemeById(previewThemeId);
  const dockPreview = useShellTemplateDockPreviewOptional();

  useEffect(() => {
    if (!dockPreview) return;
    dockPreview.setTemplateDockHex(theme.colors.appDark);
    return () => dockPreview.setTemplateDockHex(null);
  }, [theme.colors.appDark, dockPreview]);

  const chrome = useMemo(
    () =>
      shellTemplateChromeScrimBackgrounds(theme.colors.appLight, theme.colors.appDark, chromeTune),
    [theme.colors.appLight, theme.colors.appDark, chromeTune],
  );

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
    if (!el) return;
    const prev = el.style.backgroundColor;
    el.style.backgroundColor = chrome.fillBackgroundColor;
    return () => {
      if (prev) el.style.backgroundColor = prev;
      else el.style.removeProperty("background-color");
    };
  }, [chrome.fillBackgroundColor]);

  const mainStyle: CSSProperties = useMemo(
    () => ({
      ...(immersive
        ? {}
        : {
            minHeight: "calc(100dvh - var(--home-bottom-nav-slot, 70px))",
          }),
      position: "relative",
      backgroundColor: chrome.fillBackgroundColor,
    }),
    [chrome.fillBackgroundColor, immersive],
  );

  const topScrimStyle = useMemo(
    (): CSSProperties => ({
      background: chrome.topBackground,
      height: `${chromeTune.topHeightRem}rem`,
      minHeight: chromeTune.topHeightMinPx,
    }),
    [chrome.topBackground, chromeTune.topHeightRem, chromeTune.topHeightMinPx],
  );

  const bottomScrimStyle = useMemo(
    (): CSSProperties => ({
      background: chrome.bottomBackground,
      height: `${chromeTune.bottomHeightRem}rem`,
      minHeight: chromeTune.bottomHeightMinPx,
      /** 与底栏顶缘对齐，勿再 `-2px` 叠层，避免部分设备上叠出第二条细线 */
      bottom: "var(--home-bottom-nav-slot, 70px)",
    }),
    [chrome.bottomBackground, chromeTune.bottomHeightRem, chromeTune.bottomHeightMinPx],
  );

  const previewVars = useMemo(() => shellTemplatePreviewCssVars(theme), [theme]);

  const mainPadClass = immersive
    ? "overflow-hidden pb-0 pl-0 pr-0 pt-[env(safe-area-inset-top,0px)]"
    : `overflow-visible pb-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] ${MAIN_PT_CLEAR_TOP_BAR}`;

  return (
    <HomeDockChromeProvider>
      <main
        className={`relative isolate flex min-h-full w-full min-w-0 flex-col ${immersive ? "min-h-0 flex-1" : ""} ${mainPadClass}`}
        style={mainStyle}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[6] w-full"
          style={topScrimStyle}
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 z-[15] w-full"
          style={bottomScrimStyle}
        />
        <div
          ref={sampleRootRef}
          className={`relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col ${immersive ? "pb-0" : "pb-2"} ${contentClassName}`}
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
