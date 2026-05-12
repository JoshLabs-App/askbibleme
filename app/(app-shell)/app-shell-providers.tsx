"use client";

import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import { HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { AppShellFixedChrome } from "@/components/app-shell/AppShellFixedChrome";
import { MusicShellPlaybackProvider } from "@/components/music/MusicShellPlaybackContext";
import {
  ApplyRepoVisualDefaults,
  HomeAtmosphereVisualProvider,
  MusicShellAtmosphereOverrideProvider,
  MusicShellVisualProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";
import type { VisualConsoleBundleV1 } from "@/lib/music-visual/visual-console-file";

export function AppShellProviders({
  visualConsole,
  children,
}: {
  visualConsole: VisualConsoleBundleV1;
  children: React.ReactNode;
}) {
  return (
    <MusicShellPlaybackProvider>
      <MusicVisualTuningProvider>
        <HomeAtmosphereVisualProvider>
          <ApplyRepoVisualDefaults bundle={visualConsole}>
            <MusicShellAtmosphereOverrideProvider>
              <AppShellFixedChrome>
                <HomeDockChromeProvider>
                  <MusicShellVisualProvider>
                    <div
                      data-app-shell-scroll
                      className="relative z-0 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
                    >
                      {children}
                    </div>
                    <HomeBottomNav />
                  </MusicShellVisualProvider>
                </HomeDockChromeProvider>
              </AppShellFixedChrome>
            </MusicShellAtmosphereOverrideProvider>
          </ApplyRepoVisualDefaults>
        </HomeAtmosphereVisualProvider>
      </MusicVisualTuningProvider>
    </MusicShellPlaybackProvider>
  );
}
