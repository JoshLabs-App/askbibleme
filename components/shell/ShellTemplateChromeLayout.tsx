"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { AppShellTopBar, type AppShellTopBarTone } from "@/components/app-shell/AppShellTopBar";
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
import {
  PRAYER_SHELL_FILL_DARK,
  PRAYER_SHELL_FILL_LIGHT,
  PRAYER_WARM_DARK_BRAND_RGB,
} from "@/lib/prayer/prayer-shell-fill";
import {
  SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE,
} from "@/lib/read/scripture-parchment-shell";

function subscribeHtmlClassDark(onStore: () => void) {
  if (typeof window === "undefined") return () => {};
  const obs = new MutationObserver(onStore);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStore);
  return () => {
    obs.disconnect();
    mq.removeEventListener("change", onStore);
  };
}

function getHtmlDarkSnapshot(): string {
  if (typeof window === "undefined") return "0";
  return document.documentElement.classList.contains("dark") ? "1" : "0";
}

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
   * 为 true：主区横向贴边、内容区底边无额外 `pb-2`；顶内边距仅 safe-area（角标式 `AppShellTopBar` 为 fixed，不占文档流高度）。
   */
  immersive?: boolean;
  /** 传入时挂到 `AppShellTopBar` 右上槽位（与菜单角标同一行）。 */
  topBarRightAccessory?: ReactNode;
  /** 顶栏图标与字色：全幅暗底图（如金句背景）时用 `onDark`。 */
  topBarTone?: AppShellTopBarTone;
  /** 为 true 时嵌入后台预览框：底压边相对 `main` 定位、不占满视口，且不写 `[data-app-shell-scroll]` 衬底色。 */
  embedPreview?: boolean;
  /**
   * 与 `[data-app-shell-scroll]`、`main` 的 `backgroundColor` 一致。
   * 祷告等全屏暖页请传入，避免滚动区仍用壳层默认冷灰而在圆角/渐变处露出「断层」。
   */
  appShellBackground?: string;
};

/**
 * 与 `/template` 同源的主区壳：浅色衬底、`--brand-*` 预览变量、滚动区衬底同步；无顶/底渐变压边。
 * `useShellChromeScrimVisuals` 仅取 `chrome.fillBackgroundColor` 等与后台「壳层压边」同源的填充色。
 * 业务页只放内容，勿再自写一套 `main` 衬底。
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
  appShellBackground,
  topBarRightAccessory,
  topBarTone = "onLight",
}: ShellTemplateChromeLayoutProps) {
  const prayerWarmDarkSnap = useSyncExternalStore(subscribeHtmlClassDark, getHtmlDarkSnapshot, () => "0");

  const resolvedAppShellBackground = useMemo(() => {
    if (!appShellBackground) return null;
    if (appShellBackground !== PRAYER_SHELL_FILL_LIGHT) return appShellBackground;
    return prayerWarmDarkSnap === "1" ? PRAYER_SHELL_FILL_DARK : PRAYER_SHELL_FILL_LIGHT;
  }, [appShellBackground, prayerWarmDarkSnap]);

  const landscapeNarrow = useLandscapeNarrow();
  const { shellTemplateBrand } = useAppSkin();
  const previewThemeId = shellTemplateBrand ?? "lagoonPaper";
  const theme = shellTemplatePreviewThemeById(previewThemeId);
  const dockPreview = useShellTemplateDockPreviewOptional();

  const { chrome } = useShellChromeScrimVisuals(theme.colors.appLight, theme.colors.appDark, chromeTuneProp);

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
    const parchmentShell =
      document.documentElement.dataset[SCRIPTURE_PARCHMENT_SHELL_DATASET_KEY] ===
      SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE;
    if (parchmentShell) {
      el.style.removeProperty("background-color");
    } else {
      const scrollFill = resolvedAppShellBackground ?? chrome.fillBackgroundColor;
      el.style.backgroundColor = scrollFill;
    }
    return () => {
      if (prev) el.style.backgroundColor = prev;
      else el.style.removeProperty("background-color");
    };
  }, [chrome.fillBackgroundColor, embedPreview, appShellBackground, resolvedAppShellBackground]);

  const mainStyle: CSSProperties = useMemo(() => {
    const fill = resolvedAppShellBackground ?? chrome.fillBackgroundColor;
    return {
      ...(immersive
        ? {}
        : embedPreview
          ? { minHeight: 0, height: "100%", flex: 1 }
          : {
              minHeight: "calc(100dvh - var(--home-bottom-nav-slot, 70px))",
            }),
      position: "relative",
      backgroundColor: fill,
      ...(embedPreview ? { overflow: "hidden", display: "flex", flexDirection: "column" } : {}),
    };
  }, [chrome.fillBackgroundColor, immersive, embedPreview, resolvedAppShellBackground]);

  const previewVars = useMemo(() => shellTemplatePreviewCssVars(theme), [theme]);

  const contentStyle = useMemo(() => {
    const base: CSSProperties = { ...(previewVars as CSSProperties) };
    if (resolvedAppShellBackground === PRAYER_SHELL_FILL_DARK) {
      Object.assign(base, PRAYER_WARM_DARK_BRAND_RGB as CSSProperties);
    }
    return base;
  }, [previewVars, resolvedAppShellBackground]);

  const mainPadClass = immersive
    ? "overflow-hidden pb-0 pl-0 pr-0 pt-[env(safe-area-inset-top,0px)]"
    : embedPreview
      ? "min-h-0 overflow-hidden pb-6 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top,0px)]"
      : "overflow-visible pb-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top,0px)]";

  const mainMinClass = embedPreview ? "min-h-0 h-full flex-1" : immersive ? "min-h-0 flex-1" : "";

  return (
    <HomeDockChromeProvider>
      <main
        className={`relative isolate flex w-full min-w-0 flex-col ${mainMinClass} ${!immersive && !embedPreview ? "min-h-full" : ""} ${mainPadClass}`}
        style={mainStyle}
      >
        <div
          ref={sampleRootRef}
          className={`relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col ${immersive ? "pb-0" : "pb-2"} ${embedPreview ? "min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]" : ""} ${contentClassName}`}
          style={contentStyle}
        >
          {children}
        </div>
        <AppShellTopBar
          tone={topBarTone}
          landscapeImmersive={landscapeNarrow}
          rightAccessory={topBarRightAccessory}
        />
      </main>
    </HomeDockChromeProvider>
  );
}
