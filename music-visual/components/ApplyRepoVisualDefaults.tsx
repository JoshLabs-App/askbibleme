"use client";

import { useLayoutEffect, type ReactNode } from "react";
import {
  HOME_ATMOSPHERE_STORAGE_KEY,
  isHomeAtmospherePresetId,
} from "@/music-visual/presets/home-atmosphere";
import {
  MUSIC_VISUAL_TUNING_STORAGE_KEY,
  normalizeMusicVisualTuning,
} from "@/music-visual/tuning/schema";
import type { VisualConsoleBundleV1 } from "@/lib/music-visual/visual-console-file";
import { useHomeAtmosphereVisual } from "@/music-visual/providers/HomeAtmosphereVisualContext";
import { useMusicVisualTuning } from "@/music-visual/providers/MusicVisualTuningContext";

/**
 * 当浏览器尚未写入过视觉 localStorage 时，用仓库里的 `data/music-visual-console.json`
 * 作为默认（与部署版本一致）。已有本地调节则保留本地值。
 */
export function ApplyRepoVisualDefaults({
  bundle,
  children,
}: {
  bundle: VisualConsoleBundleV1 | null;
  children: ReactNode;
}) {
  const { replaceTuning } = useMusicVisualTuning();
  const { setHomeAtmospherePresetId } = useHomeAtmosphereVisual();

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !bundle) return;
    try {
      if (!window.localStorage.getItem(MUSIC_VISUAL_TUNING_STORAGE_KEY)) {
        replaceTuning(normalizeMusicVisualTuning(bundle.tuning));
      }
      const hid = bundle.homeAtmospherePresetId;
      if (
        hid &&
        isHomeAtmospherePresetId(hid) &&
        !window.localStorage.getItem(HOME_ATMOSPHERE_STORAGE_KEY)
      ) {
        setHomeAtmospherePresetId(hid);
      }
    } catch {
      /* ignore */
    }
  }, [bundle, replaceTuning, setHomeAtmospherePresetId]);

  return <>{children}</>;
}
