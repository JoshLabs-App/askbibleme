import { useMemo } from "react";
import type { HomeAtmospherePresetId } from "@/music-visual/presets/home-atmosphere";
import { getMusicVisualAtmospherePresetForHome } from "@/music-visual/presets/home-atmosphere";

/** 首页氛围 ID → 引擎 atmosphere preset（经 `getMusicVisualAtmospherePresetForHome` 映射） */
export function useResolvedHomeAtmospherePreset(homeId: HomeAtmospherePresetId) {
  return useMemo(() => getMusicVisualAtmospherePresetForHome(homeId), [homeId]);
}
