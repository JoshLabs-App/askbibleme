import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cookies, headers } from "next/headers";
import { PARCHMENT_SHELL_BOOT_SCRIPT } from "@/lib/read/parchment-shell-boot";
import { SYNC_HTML_DARK_CLASS_BOOT_SCRIPT } from "@/lib/read/sync-html-dark-class";
import { isSamsungGalaxyUserAgent } from "@/lib/read/parchment-samsung-device";
import { SELAH_REQUEST_PATHNAME_HEADER } from "@/lib/read/request-pathname";
import {
  isScriptureParchmentPath,
  SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_VALUE,
  SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE,
} from "@/lib/read/scripture-parchment-shell";
import "./globals.css";
import "./(app-shell)/read/read-parchment-background.css";
import "./(app-shell)/read/read-parchment-shell-chrome.css";
import { AppUpdateNotifier } from "@/components/app-shell/AppUpdateNotifier";
import { PwaServiceWorkerRegistration } from "@/components/app-shell/PwaServiceWorkerRegistration";
import { ParchmentShellRouteEffect } from "@/components/shell/ParchmentShellRouteEffect";
import { AskbibleUserProvider } from "@/components/auth/AskbibleUserProvider";
import { MemberReadingSyncBridge } from "@/components/member/MemberReadingSyncBridge";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { CuvChapterAudioVoiceProvider } from "@/components/bible/CuvChapterAudioVoiceContext";
import { MediaPlaybackCoordinatorProvider } from "@/components/media/MediaPlaybackCoordinatorProvider";
import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import { AppSkinProvider } from "@/components/theme/AppSkinProvider";
import { getAppBuildId } from "@/lib/app-build-id";
import { brandingAssetsExist, getResolvedBrandColors, getResolvedLogoBackground } from "@/lib/site-branding";
import {
  brandCanvasColorScheme,
  brandColorsToCssVars,
  logoBackgroundToCssVars,
} from "@/lib/site-branding-colors";
import {
  inferAppLocaleFromAcceptLanguage,
  LOCALE_COOKIE_NAME,
  parseLocale,
  type AppLocale,
} from "@/lib/i18n/config";
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
    description: "安静回到经文的入口 — 正在成型。",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const colors = await getResolvedBrandColors();
  const logoBackground = await getResolvedLogoBackground();
  const cookieStore = await cookies();
  const headerList = await headers();
  const cookieRaw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const initialLocaleGuess: AppLocale = cookieRaw
    ? parseLocale(cookieRaw)
    : inferAppLocaleFromAcceptLanguage(headerList.get("accept-language"));
  const htmlLang = initialLocaleGuess === "en" ? "en" : "zh-CN";
  const pathname = headerList.get(SELAH_REQUEST_PATHNAME_HEADER) ?? "";
  const parchmentShell = isScriptureParchmentPath(pathname);
  const samsungParchment =
    parchmentShell && isSamsungGalaxyUserAgent(headerList.get("user-agent") ?? "");

  const appBuildId = getAppBuildId();

  return (
    <html
      lang={htmlLang}
      style={
        {
          ...brandColorsToCssVars(colors),
          ...logoBackgroundToCssVars(logoBackground),
        } as CSSProperties
      }
      suppressHydrationWarning
      data-app-shell-safe-fill={parchmentShell ? SCRIPTURE_PARCHMENT_SHELL_DATASET_VALUE : undefined}
      data-read-parchment-samsung={
        samsungParchment ? SCRIPTURE_PARCHMENT_SAMSUNG_DATASET_VALUE : undefined
      }
    >
      <body className="min-h-screen font-sans text-[15px] leading-relaxed" data-app-build={appBuildId}>
        <Script id="selah-sync-html-dark-class" strategy="beforeInteractive">
          {SYNC_HTML_DARK_CLASS_BOOT_SCRIPT}
        </Script>
        <Script id="selah-parchment-shell-boot" strategy="beforeInteractive">
          {PARCHMENT_SHELL_BOOT_SCRIPT}
        </Script>
        <AppSkinProvider>
          <LocaleProvider initialLocaleGuess={initialLocaleGuess}>
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
        </AppSkinProvider>
      </body>
    </html>
  );
}
