"use client";

import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import { HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { HomePrayerVerseFeedProvider } from "@/components/home/HomePrayerVerseFeedContext";
import { ShellTemplateDockPreviewProvider } from "@/components/shell/ShellTemplateDockPreviewContext";
import { NatureBackgroundVideoPrefetch } from "@/components/nature/NatureBackgroundVideoPrefetch";
import { AppShellFixedChrome } from "@/components/app-shell/AppShellFixedChrome";
import { FirstOpenHintGate } from "@/components/app-shell/FirstOpenHintGate";
import { AppShellScrollArea } from "@/components/app-shell/AppShellScrollArea";
import { ReadBibleTypographyProvider } from "@/components/bible/ReadBibleTypographyProvider";
import { TelemetryProvider } from "@/components/telemetry/TelemetryProvider";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

type Props = {
  children: React.ReactNode;
  verseFallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
};

export function AppShellProviders({ children, verseFallbackByLocale }: Props) {
  return (
    <TelemetryProvider>
      <ReadBibleTypographyProvider>
        <AppShellFixedChrome>
          <ShellTemplateDockPreviewProvider>
            <HomeDockChromeProvider>
              <HomePrayerVerseFeedProvider fallbackByLocale={verseFallbackByLocale}>
                <NatureBackgroundVideoPrefetch />
                <AppShellScrollArea>{children}</AppShellScrollArea>
                <HomeBottomNav />
                <FirstOpenHintGate />
              </HomePrayerVerseFeedProvider>
            </HomeDockChromeProvider>
          </ShellTemplateDockPreviewProvider>
        </AppShellFixedChrome>
      </ReadBibleTypographyProvider>
    </TelemetryProvider>
  );
}
