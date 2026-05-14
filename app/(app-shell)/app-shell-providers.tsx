"use client";

import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import { HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { HomePrayerVerseFeedProvider } from "@/components/home/HomePrayerVerseFeedContext";
import { ShellTemplateDockPreviewProvider } from "@/components/shell/ShellTemplateDockPreviewContext";
import { NatureBackgroundVideoPrefetch } from "@/components/nature/NatureBackgroundVideoPrefetch";
import { AppShellFixedChrome } from "@/components/app-shell/AppShellFixedChrome";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

type Props = {
  children: React.ReactNode;
  verseFallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
};

export function AppShellProviders({ children, verseFallbackByLocale }: Props) {
  return (
    <AppShellFixedChrome>
      <ShellTemplateDockPreviewProvider>
        <HomeDockChromeProvider>
          <HomePrayerVerseFeedProvider fallbackByLocale={verseFallbackByLocale}>
            <NatureBackgroundVideoPrefetch />
            <div
              data-app-shell-scroll
              className="relative z-0 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain border-0 border-b-0 shadow-none [-webkit-overflow-scrolling:touch]"
            >
              {children}
            </div>
            <HomeBottomNav />
          </HomePrayerVerseFeedProvider>
        </HomeDockChromeProvider>
      </ShellTemplateDockPreviewProvider>
    </AppShellFixedChrome>
  );
}
