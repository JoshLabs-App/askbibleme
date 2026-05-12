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
            <div
              data-admin-shell="light"
              className="fixed inset-0 z-0 flex min-h-0 w-full flex-col overflow-hidden bg-adminBg text-[15px] font-sans leading-relaxed text-adminFg antialiased selection:bg-sand/25"
            >
              {children}
            </div>
          </MusicShellVisualProvider>
        </ApplyRepoVisualDefaults>
      </HomeAtmosphereVisualProvider>
    </MusicVisualTuningProvider>
  );
}
