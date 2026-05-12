import type { MusicVisualAtmospherePreset } from "../presets/atmosphere";
import type { MusicVisualAtmosphereScalars } from "../types/atmosphere-scalars";

/**
 * 首页氛围 preset → 音乐视觉引擎标量（调制 CSS `--music-*`）。
 */
export function atmosphereScalarsFromPreset(
  preset: MusicVisualAtmospherePreset,
): MusicVisualAtmosphereScalars {
  return {
    fogSpeedMul: preset.fogSpeedMul,
    glowWeightMul: preset.glowWeightMul,
    particleDensityMul: preset.particleDensityMul,
  };
}
