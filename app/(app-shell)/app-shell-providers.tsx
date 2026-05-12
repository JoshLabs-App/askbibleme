"use client";

import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import { HomeDockChromeProvider } from "@/components/home/HomeDockChromeContext";
import { ShellTemplateDockPreviewProvider } from "@/components/shell/ShellTemplateDockPreviewContext";
import { NatureBackgroundVideoPrefetch } from "@/components/nature/NatureBackgroundVideoPrefetch";
import { AppShellFixedChrome } from "@/components/app-shell/AppShellFixedChrome";
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
    <MusicVisualTuningProvider>
      <HomeAtmosphereVisualProvider>
        <ApplyRepoVisualDefaults bundle={visualConsole}>
          <MusicShellAtmosphereOverrideProvider>
            <AppShellFixedChrome>
              <ShellTemplateDockPreviewProvider>
                <HomeDockChromeProvider>
                  <NatureBackgroundVideoPrefetch />
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
              </ShellTemplateDockPreviewProvider>
            </AppShellFixedChrome>
          </MusicShellAtmosphereOverrideProvider>
        </ApplyRepoVisualDefaults>
      </HomeAtmosphereVisualProvider>
    </MusicVisualTuningProvider>
  );
}
