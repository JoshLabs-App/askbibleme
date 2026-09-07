import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PARCHMENT_SHELL_BOOT_SCRIPT } from "@/lib/read/parchment-shell-boot";
import { SYNC_HTML_DARK_CLASS_BOOT_SCRIPT } from "@/lib/read/sync-html-dark-class";
import "./globals.css";
import "./(app-shell)/read/read-parchment-background.css";
import "./(app-shell)/read/read-parchment-shell-chrome.css";
import { AppUpdateNotifier } from "@/components/app-shell/AppUpdateNotifier";
import { AppImmersiveProvider } from "@/components/app-shell/AppImmersiveProvider";
import { PwaServiceWorkerRegistration } from "@/components/app-shell/PwaServiceWorkerRegistration";
import { ParchmentShellRouteEffect } from "@/components/shell/ParchmentShellRouteEffect";
import { AskbibleUserProvider } from "@/components/auth/AskbibleUserProvider";
import { MemberReadingSyncBridge } from "@/components/member/MemberReadingSyncBridge";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { CuvChapterAudioVoiceProvider } from "@/components/bible/CuvChapterAudioVoiceContext";
import { MediaPlaybackCoordinatorProvider } from "@/components/media/MediaPlaybackCoordinatorProvider";
import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import { getAppBuildId } from "@/lib/app-build-id";
import { brandingAssetsExist, getResolvedBrandColors, getResolvedLogoBackground } from "@/lib/site-branding";
import {
  brandCanvasColorScheme,
  brandColorsToCssVars,
  logoBackgroundToCssVars,
} from "@/lib/site-branding-colors";
import {
  SITE_METADATA_DEFAULT_TITLE,
  SITE_METADATA_TITLE_TEMPLATE,
} from "@/lib/site-metadata-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const brandingReady = await brandingAssetsExist();

  const appTitle = SITE_METADATA_DEFAULT_TITLE;

  return {
    manifest: "/manifest.webmanifest",
    /** 安卓 Chrome「添加到主屏幕」等 */
    applicationName: appTitle,
    title: {
      default: appTitle,
      template: SITE_METADATA_TITLE_TEMPLATE,
    },
    description: "一个安静回到经文的入口。",
    appleWebApp: {
      capable: true,
      title: appTitle,
      statusBarStyle: "black-translucent",
    },
    icons: brandingReady
      ? {
          icon: [
            {
              url: "/branding/favicon-32.png",
              sizes: "32x32",
              type: "image/png",
            },
          ],
          apple: "/branding/apple-touch-icon.png",
        }
      : {
          icon: [{ url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" }],
          apple: "/icons/icon-192.png",
        },
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-title": appTitle,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const colors = await getResolvedBrandColors();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: colors.canvas,
    colorScheme: brandCanvasColorScheme(colors.canvas),
  };
}

/** 构建期写入的兜底值；真实语言由 LocaleProvider 水合后改写 <html lang>。 */
const DEFAULT_HTML_LANG = "zh-CN";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const colors = await getResolvedBrandColors();
  const logoBackground = await getResolvedLogoBackground();
  /**
   * 这里曾用 cookies()/headers() 判定语言、羊皮卷外壳与三星机型。只要读了请求，整站
   * 所有页面都会被迫动态渲染——那是迁到静态托管（Cloudflare Pages 免费额度）的最大障碍，
   * 而这三件事客户端都做得了：
   * - 语言：LocaleProvider 于客户端按 localStorage → cookie → navigator 判定，
   *   并在 useLayoutEffect 里同步 <html lang>；
   * - 羊皮卷外壳与三星机型：PARCHMENT_SHELL_BOOT_SCRIPT 以 beforeInteractive 在水合前
   *   读 location.pathname 与 navigator.userAgent 设好同名 dataset，它本就写成
   *   「服务端没设才设」的补位逻辑，去掉服务端这半边它会自然接管。
   */
  const appBuildId = getAppBuildId();

  return (
    <html
      /** 构建期固定；LocaleProvider 水合后按实际语言改写。 */
      lang={DEFAULT_HTML_LANG}
      style={
        {
          ...brandColorsToCssVars(colors),
          ...logoBackgroundToCssVars(logoBackground),
        } as CSSProperties
      }
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans text-[15px] leading-relaxed" data-app-build={appBuildId}>
        <Script id="selah-sync-html-dark-class" strategy="beforeInteractive">
          {SYNC_HTML_DARK_CLASS_BOOT_SCRIPT}
        </Script>
        <Script id="selah-parchment-shell-boot" strategy="beforeInteractive">
          {PARCHMENT_SHELL_BOOT_SCRIPT}
        </Script>
        <AppImmersiveProvider>
          <LocaleProvider>
            <AskbibleUserProvider>
              <MemberReadingSyncBridge />
              <CuvChapterAudioVoiceProvider>
                <MusicShellPlaybackProvider>
                  <MediaPlaybackCoordinatorProvider>
                    <ParchmentShellRouteEffect />
                    {children}
                    <PwaServiceWorkerRegistration />
                    <AppUpdateNotifier />
                  </MediaPlaybackCoordinatorProvider>
                </MusicShellPlaybackProvider>
              </CuvChapterAudioVoiceProvider>
            </AskbibleUserProvider>
          </LocaleProvider>
        </AppImmersiveProvider>
      </body>
    </html>
  );
}
