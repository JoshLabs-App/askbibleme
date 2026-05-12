import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { AppUpdateNotifier } from "@/components/app-shell/AppUpdateNotifier";
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

export async function generateMetadata(): Promise<Metadata> {
  const brandingReady = await brandingAssetsExist();

  return {
    manifest: "/manifest.webmanifest",
    title: {
      default: "Selah.my",
      template: "%s | Selah.my",
    },
    description: "安静回到经文的入口 — 正在成型。",
    appleWebApp: {
      capable: true,
      title: "Selah.my",
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
        <AppSkinProvider>
          <LocaleProvider initialLocaleGuess={initialLocaleGuess}>
            <MusicShellPlaybackProvider>
              {children}
              <AppUpdateNotifier />
            </MusicShellPlaybackProvider>
          </LocaleProvider>
        </AppSkinProvider>
      </body>
    </html>
  );
}
