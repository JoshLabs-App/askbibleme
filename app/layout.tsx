import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cookies, headers } from "next/headers";
import { PARCHMENT_SHELL_BOOT_SCRIPT } from "@/lib/read/parchment-shell-boot";
import "./globals.css";
import { AppUpdateNotifier } from "@/components/app-shell/AppUpdateNotifier";
import { AskbibleUserProvider } from "@/components/auth/AskbibleUserProvider";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import { AppSkinProvider } from "@/components/theme/AppSkinProvider";
import { getAppBuildId } from "@/lib/app-build-id";
import { brandingAssetsExist, getResolvedBrandColors } from "@/lib/site-branding";
import { brandColorsToCssVars } from "@/lib/site-branding-colors";
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
    colorScheme: "dark",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const colors = await getResolvedBrandColors();
  const cookieStore = await cookies();
  const headerList = await headers();
  const cookieRaw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const initialLocaleGuess: AppLocale = cookieRaw
    ? parseLocale(cookieRaw)
    : inferAppLocaleFromAcceptLanguage(headerList.get("accept-language"));
  const htmlLang = initialLocaleGuess === "en" ? "en" : "zh-CN";

  const appBuildId = getAppBuildId();

  return (
    <html lang={htmlLang} style={brandColorsToCssVars(colors) as CSSProperties}>
      <body className="min-h-screen font-sans text-[15px] leading-relaxed" data-app-build={appBuildId}>
        <Script id="selah-parchment-shell-boot" strategy="beforeInteractive">
          {PARCHMENT_SHELL_BOOT_SCRIPT}
        </Script>
        <AppSkinProvider>
          <LocaleProvider initialLocaleGuess={initialLocaleGuess}>
            <AskbibleUserProvider>
              <MusicShellPlaybackProvider>
                {children}
                <AppUpdateNotifier />
              </MusicShellPlaybackProvider>
            </AskbibleUserProvider>
          </LocaleProvider>
        </AppSkinProvider>
      </body>
    </html>
  );
}
