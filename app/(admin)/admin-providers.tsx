"use client";

import {
  ApplyRepoVisualDefaults,
  HomeAtmosphereVisualProvider,
  MusicShellVisualProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";
import type { VisualConsoleBundleV1 } from "@/lib/music-visual/visual-console-file";

export function AdminProviders({
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
          <MusicShellVisualProvider>
            <div className="fixed bottom-0 left-0 right-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-0 flex min-h-0 w-full flex-col overflow-hidden bg-adminBg transform-gpu">
              {children}
            </div>
          </MusicShellVisualProvider>
        </ApplyRepoVisualDefaults>
      </HomeAtmosphereVisualProvider>
    </MusicVisualTuningProvider>
  );
}
