"use client";

import type { ReactNode } from "react";
import {
  ApplyRepoVisualDefaults,
  MusicShellAtmosphereOverrideProvider,
  MusicVisualTuningProvider,
} from "@/music-visual";
import type { VisualConsoleBundleV1 } from "@/lib/music-visual/visual-console-file";

/** `/music` 独立路由：不含主导航壳，仅音乐页所需视觉/氛围 Provider */
export function MusicRouteProviders({
  visualConsole,
  children,
}: {
  visualConsole: VisualConsoleBundleV1;
  children: ReactNode;
}) {
  return (
    <MusicVisualTuningProvider>
      <ApplyRepoVisualDefaults bundle={visualConsole}>
        <MusicShellAtmosphereOverrideProvider>{children}</MusicShellAtmosphereOverrideProvider>
      </ApplyRepoVisualDefaults>
    </MusicVisualTuningProvider>
  );
}
