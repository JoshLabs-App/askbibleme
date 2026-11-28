import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PARCHMENT_SHELL_BOOT_SCRIPT } from "@/lib/read/parchment-shell-boot";
import { SYNC_HTML_DARK_CLASS_BOOT_SCRIPT } from "@/lib/read/sync-html-dark-class";
// 图标字体自托管（原来从 fonts.googleapis.com / cdn.jsdelivr.net 引，国内不稳且阻塞渲染）
import "material-icons/iconfont/filled.css";
import "@mdi/font/css/materialdesignicons.min.css";
import "./tokens.css";
import "./globals.css";
import "./(app-shell)/read/read-parchment-background.css";
import "./(app-shell)/read/read-parchment-shell-chrome.css";
import { AppUpdateNotifier } from "@/components/app-shell/AppUpdateNotifier";
import { AskBibleAgentBridge } from "@/components/app-shell/AskBibleAgentBridge";
import { CodeProbeProvider } from "@/components/app-shell/AskBibleCodeProbe";
import { MobileModelStage } from "@/components/app-shell/MobileModelStage";
import { TvAutoMode } from "@/components/app-shell/TvAutoMode";
import { EndpointsBoot } from "@/components/shell/EndpointsBoot";
import { AppImmersiveProvider } from "@/components/app-shell/AppImmersiveProvider";
import { PwaServiceWorkerRegistration } from "@/components/app-shell/PwaServiceWorkerRegistration";
import { ParchmentShellRouteEffect } from "@/components/shell/ParchmentShellRouteEffect";
import { AskbibleUserProvider } from "@/components/auth/AskbibleUserProvider";
import { AchievementFeedbackLayer } from "@/components/achievements/AchievementFeedbackLayer";
import { MemberReadingSyncBridge } from "@/components/member/MemberReadingSyncBridge";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { CuvChapterAudioVoiceProvider } from "@/components/bible/CuvChapterAudioVoiceContext";
import { MediaPlaybackCoordinatorProvider } from "@/components/media/MediaPlaybackCoordinatorProvider";
import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import { getAppBuildId, getAppBuiltAt } from "@/lib/app-build-id";
import { brandingAssetsExist, getResolvedBrandColors, getResolvedLogoBackground } from "@/lib/site-branding";
import {
  brandCanvasColorScheme,
  brandColorsToCssVars,
  logoBackgroundToCssVars,
} from "@/lib/site-branding-colors";
import { SITE_METADATA_DEFAULT_TITLE } from "@/lib/site-metadata-defaults";
import { buildRouteJsonLd } from "@/lib/ai/askbible-ai-docs.mjs";
import { PRODUCT_ORIGIN } from "@/lib/ai/askbible-ai-catalog.mjs";

export async function generateMetadata(): Promise<Metadata> {
  const brandingReady = await brandingAssetsExist();

  const appTitle = SITE_METADATA_DEFAULT_TITLE;

  return {
    manifest: "/manifest.webmanifest",
    /** 安卓 Chrome「添加到主屏幕」等 */
    applicationName: appTitle,
    // Page metadata already uses sitePageTitle; a parent template repeats the brand.
    title: appTitle,
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
  const appBuildId = getAppBuildId();
  const appBuiltAt = getAppBuiltAt();
  const siteJsonLd = JSON.stringify(buildRouteJsonLd("/", PRODUCT_ORIGIN)).replace(/<\//g, "<\\/");

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
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs Context" />
        <link rel="mcp-server" href="/mcp" title="AskBible.me Remote MCP" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: siteJsonLd }}
        />
      </head>
      <body
        className="min-h-screen font-sans text-[15px] leading-relaxed"
        data-app-build={appBuildId}
        data-app-built-at={appBuiltAt || undefined}
      >
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
              <AchievementFeedbackLayer />
              <CuvChapterAudioVoiceProvider>
                <MusicShellPlaybackProvider>
                  <MediaPlaybackCoordinatorProvider>
                    <CodeProbeProvider>
                      <MobileModelStage>
                        <ParchmentShellRouteEffect />
                        {children}
                      </MobileModelStage>
                    </CodeProbeProvider>
                    <PwaServiceWorkerRegistration />
                    <EndpointsBoot />
                    <AppUpdateNotifier />
                    <AskBibleAgentBridge />
                    <TvAutoMode />
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
